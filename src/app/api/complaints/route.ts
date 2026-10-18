import { randomBytes } from "node:crypto";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint, ServiceRequest } from "@/lib/models";
import mongoose from "mongoose";

const complaintSubjects = ["service_issue", "delay", "document_concern", "payment", "other"] as const;

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to view complaints.", 401);
    if (user.role === "agent" && user.verificationStatus !== "verified") {
      return apiError("Your agent account must be verified before viewing complaints.", 403);
    }
    await connectToDatabase();
    const requestFilter = user.role === "agent"
      ? { serviceRequest: { $in: await ServiceRequest.distinct("_id", { assignedAgent: user.id }) } }
      : { citizen: user.id };
    const complaints = user.role === "admin"
      ? await Complaint.find({})
          .populate("citizen", "name")
          .populate("serviceRequest", "reference serviceName status")
          .sort({ createdAt: -1 })
          .lean()
      : await Complaint.find(requestFilter)
          .populate("serviceRequest", "reference serviceName status")
          .sort({ createdAt: -1 })
          .lean();
    return Response.json({ complaints });
  } catch (error) {
    console.error("Complaint history lookup failed:", error);
    return apiError("Complaint history is temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to raise a complaint.", 401);
    if (user.role !== "citizen") return apiError("Complaints must be submitted from a citizen account.", 403);
    const body = (await request.json()) as Record<string, unknown>;
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const subject = body.subject;
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (
      !requestId ||
      !mongoose.isValidObjectId(requestId) ||
      typeof subject !== "string" ||
      !complaintSubjects.includes(subject as (typeof complaintSubjects)[number]) ||
      description.length < 10 ||
      description.length > 2000
    ) {
      return apiError("Select a complaint type and enter at least 10 characters of detail.", 400);
    }

    await connectToDatabase();
    const serviceRequest = await ServiceRequest.findOne({ _id: requestId, citizen: user.id });
    if (!serviceRequest) return apiError("Service request not found.", 404);
    const complaint = await Complaint.create({
      reference: `JC-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`,
      citizen: user.id,
      serviceRequest: serviceRequest.id,
      subject,
      description,
      status: "open",
    });
    return Response.json(
      { complaint: { id: complaint.id, reference: complaint.reference, status: complaint.status } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Complaint submission failed:", error);
    return apiError("Your complaint could not be submitted right now.", 503);
  }
}
