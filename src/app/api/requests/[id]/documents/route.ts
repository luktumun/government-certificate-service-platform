import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ServiceRequest, UploadedFile } from "@/lib/models";

const maximumFileSize = 10 * 1024 * 1024;
const maximumFiles = 5;
const maximumRequestSize = maximumFileSize * maximumFiles + 256 * 1024;

function hasValidFileSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  }
  return mimeType === "image/jpeg" && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const savedFiles: string[] = [];
  try {
    const declaredSize = Number(request.headers.get("content-length"));
    if (declaredSize > maximumRequestSize) return apiError("The request is too large.", 413);
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to upload request documents.", 401);
    if (user.role === "agent" && user.verificationStatus !== "verified") {
      return apiError("Your agent account must be verified first.", 403);
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return apiError("Service request not found.", 404);
    await connectToDatabase();
    const serviceRequest = await ServiceRequest.findById(id).select("+documents.storageKey");
    if (!serviceRequest) return apiError("Service request not found.", 404);
    const isCitizen = serviceRequest.citizen?.equals(user.id) ?? false;
    const isAssignedAgent = serviceRequest.assignedAgent?.equals(user.id) ?? false;
    if (!isCitizen && !isAssignedAgent && user.role !== "admin") {
      return apiError("You cannot add documents to this request.", 403);
    }

    const form = await request.formData();
    const files = form.getAll("documents").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return apiError("Choose at least one document to upload.", 400);
    if (files.length > maximumFiles || serviceRequest.documents.length + files.length > maximumFiles) {
      return apiError("A request can contain no more than 5 documents.", 400);
    }

    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    for (const file of files) {
      if (!allowedTypes.has(file.type) || file.size > maximumFileSize) {
        throw new Error("INVALID_UPLOAD");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasValidFileSignature(bytes, file.type)) throw new Error("INVALID_UPLOAD");

      const extension = file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : ".jpg";
      const storageKey = `${randomUUID()}${extension}`;
      await UploadedFile.create({ storageKey, content: Buffer.from(bytes) });
      savedFiles.push(storageKey);
      serviceRequest.documents.push({
        originalName: file.name.replace(/[^\w.-]/g, "_").slice(0, 100) || "document",
        storageKey,
        mimeType: file.type,
        size: file.size,
      });
    }

    await serviceRequest.save();
    return Response.json({ documents: serviceRequest.documents.map((document) => ({
      id: document._id.toString(),
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
    })) }, { status: 201 });
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
    console.error("Request document upload failed:", error);
    return apiError("Documents could not be uploaded right now.", 503);
  }
}
