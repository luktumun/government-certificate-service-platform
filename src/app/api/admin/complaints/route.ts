import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Complaint, type ComplaintStatus } from "@/lib/models";
import mongoose from "mongoose";

const complaintStatuses: ComplaintStatus[] = ["investigating", "escalated", "resolved", "closed"];

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to manage complaints.", 401);
    if (user.role !== "admin") return apiError("Administrator access is required.", 403);
    await connectToDatabase();
    const complaints = await Complaint.find({})
      .populate("citizen", "name email")
      .populate("serviceRequest", "reference serviceName status")
      .sort({ createdAt: -1 })
      .lean();
    return Response.json({ complaints });
  } catch (error) {
    console.error("Admin complaint lookup failed:", error);
    return apiError("Complaint records are temporarily unavailable.", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to manage complaints.", 401);
    if (user.role !== "admin") return apiError("Administrator access is required.", 403);
    const body = (await request.json()) as Record<string, unknown>;
    const complaintId = typeof body.complaintId === "string" ? body.complaintId : "";
    const status = body.status;
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
    if (
      !complaintId ||
      !mongoose.isValidObjectId(complaintId) ||
      typeof status !== "string" ||
      !complaintStatuses.includes(status as ComplaintStatus) ||
      resolutionNote.length > 1000
    ) {
      return apiError("Choose a valid complaint and status.", 400);
    }

    await connectToDatabase();
    const complaint = await Complaint.findByIdAndUpdate(
      complaintId,
      { status, resolutionNote },
      { new: true, runValidators: true },
    );
    if (!complaint) return apiError("Complaint not found.", 404);
    return Response.json({ complaint: { id: complaint.id, reference: complaint.reference, status: complaint.status } });
  } catch (error) {
    console.error("Complaint update failed:", error);
    return apiError("Complaint status could not be updated.", 503);
  }
}
