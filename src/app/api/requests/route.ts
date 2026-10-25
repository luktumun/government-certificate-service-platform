import { randomBytes, randomUUID } from "node:crypto";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Service, ServiceRequest, UploadedFile } from "@/lib/models";

const maximumFileSize = 10 * 1024 * 1024;
const maximumFiles = 5;
const maximumRequestSize = maximumFileSize * maximumFiles + 256 * 1024;
const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function hasValidFileSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  }
  return mimeType === "image/jpeg" && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to view service requests.", 401);
    await connectToDatabase();

    if (user.role === "agent") {
      if (user.verificationStatus !== "verified") {
        return apiError("Your agent account must be verified before viewing requests.", 403);
      }
      const [assignedRequests, availableRequests] = await Promise.all([
        ServiceRequest.find({ assignedAgent: user.id })
          .select("-documents.storageKey")
          .populate("citizen", "name")
          .populate("assignedAgent", "name")
          .sort({ createdAt: -1 })
          .lean(),
        ServiceRequest.find({
          $and: [
            { status: "submitted", $or: [{ assignedAgent: null }, { assignedAgent: { $exists: false } }] },
            {
              $or: user.serviceAreas.map((area) => ({
                location: { $regex: area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
              })),
            },
          ],
        })
          .select("reference serviceName status quotedTotal createdAt")
          .sort({ createdAt: -1 })
          .lean(),
      ]);
      return Response.json({
        requests: [
          ...assignedRequests,
          ...availableRequests.map((serviceRequest) => ({ ...serviceRequest, canAccept: true })),
        ],
      });
    }

    const requestQuery =
      user.role === "admin"
        ? ServiceRequest.find({})
        : ServiceRequest.find({ citizen: user.id });
    const requests = await requestQuery
      .select("-documents.storageKey")
      .populate("citizen", "name")
      .populate("assignedAgent", "name")
      .sort({ createdAt: -1 })
      .lean();
    return Response.json({ requests });
  } catch (error) {
    console.error("Request history lookup failed:", error);
    return apiError("Request history is temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  const savedFiles: string[] = [];
  try {
    const declaredSize = Number(request.headers.get("content-length"));
    if (declaredSize > maximumRequestSize) return apiError("The request is too large.", 413);
    const user = await getSessionUser(request);
    if (user && user.role !== "citizen") return apiError("Only citizens can submit service requests.", 403);

    const form = await request.formData();
    const serviceSlug = form.get("serviceSlug");
    const applicantName = form.get("applicantName");
    const contactPhone = form.get("contactPhone");
    const location = form.get("location");
    const notes = form.get("notes");
    const additionalFiles = form
      .getAll("documents")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (
      typeof serviceSlug !== "string" ||
      typeof applicantName !== "string" ||
      applicantName.trim().length < 2 ||
      applicantName.trim().length > 100 ||
      typeof contactPhone !== "string" ||
      !/^[+\d][\d\s()-]{7,23}$/.test(contactPhone.trim()) ||
      typeof location !== "string" ||
      location.trim().length < 2 ||
      location.trim().length > 200 ||
      (typeof notes === "string" && notes.length > 1000)
    ) {
      return apiError("Check the applicant, phone, and location details and try again.", 400);
    }
    await connectToDatabase();
    const service = await Service.findOne({ slug: serviceSlug, active: true });
    if (!service) return apiError("That service is unavailable.", 404);

    const requiredFiles = service.requiredDocuments.flatMap((documentType, index) => {
      const entry = form.get(`requiredDocument-${index}`);
      if (entry === null) return [];
      if (!(entry instanceof File)) throw new Error("INVALID_DOCUMENT_FIELD");
      return entry.size > 0 ? [{ file: entry, documentType }] : [];
    });
    const files = [
      ...requiredFiles,
      ...additionalFiles.map((file) => ({ file, documentType: "Additional supporting document" })),
    ];
    if (files.length > maximumFiles) return apiError("Upload no more than 5 documents.", 400);

    const documents = [];
    for (const { file, documentType } of files) {
      if (!acceptedTypes.has(file.type) || file.size > maximumFileSize) {
        throw new Error("INVALID_UPLOAD");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasValidFileSignature(bytes, file.type)) throw new Error("INVALID_UPLOAD");

      const extension = file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : ".jpg";
      const storageKey = `${randomUUID()}${extension}`;
      await UploadedFile.create({ storageKey, content: Buffer.from(bytes) });
      savedFiles.push(storageKey);

      documents.push({
        originalName: file.name.replace(/[^\w.-]/g, "_").slice(0, 100) || "document",
        documentType,
        storageKey,
        mimeType: file.type,
        size: file.size,
      });
    }

    const reference = `JS-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const created = await ServiceRequest.create({
      reference,
      ...(user ? { citizen: user.id } : {}),
      service: service.id,
      serviceName: service.name,
      applicantName: applicantName.trim(),
      contactPhone: contactPhone.trim(),
      location: location.trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
      status: "submitted",
      quotedTotal: service.governmentFee + service.assistanceFee,
      governmentFee: service.governmentFee,
      assistanceFee: service.assistanceFee,
      documents,
      timeline: [{ status: "submitted", note: "Request submitted for review.", ...(user ? { updatedBy: user.id } : {}) }],
    });
    return Response.json(
      {
        request: {
          id: created.id,
          reference: created.reference,
          status: created.status,
          serviceName: created.serviceName,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (savedFiles.length > 0) {
      try {
        await UploadedFile.deleteMany({ storageKey: { $in: savedFiles } });
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded request files:", cleanupError);
      }
    }
    if (error instanceof Error && error.message === "INVALID_UPLOAD") {
      return apiError("Upload a valid PDF, JPG, or PNG file (10 MB maximum each).", 400);
    }
    if (error instanceof Error && error.message === "INVALID_DOCUMENT_FIELD") {
      return apiError("A document upload field was invalid. Please try again.", 400);
    }
    console.error("Service request submission failed:", error);
    return apiError("Your request could not be submitted right now.", 503);
  }
}
