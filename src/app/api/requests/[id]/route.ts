import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ServiceRequest, type RequestStatus } from "@/lib/models";
import mongoose from "mongoose";

const allowedStatuses: RequestStatus[] = [
  "under_review",
  "accepted",
  "in_progress",
  "documents_required",
  "completed",
  "rejected",
  "cancelled",
];

const agentTransitions: Record<RequestStatus, RequestStatus[]> = {
  submitted: ["under_review", "rejected"],
  under_review: ["in_progress", "documents_required", "rejected"],
  accepted: ["in_progress", "documents_required", "rejected"],
  in_progress: ["documents_required", "completed", "rejected"],
  documents_required: ["in_progress", "rejected"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to update a service request.", 401);
    if (user.role !== "agent" && user.role !== "admin") return apiError("You cannot update service requests.", 403);
    if (user.role === "agent" && user.verificationStatus !== "verified") {
      return apiError("Your agent account must be verified first.", 403);
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return apiError("Service request not found.", 404);
    const body = (await request.json()) as Record<string, unknown>;
    const status = body.status;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    if (typeof status !== "string" || !allowedStatuses.includes(status as RequestStatus)) {
      return apiError("Choose a valid request status.", 400);
    }

    await connectToDatabase();
    if (user.role === "agent") {
      if (status === "accepted") {
        const claimed = await ServiceRequest.findOneAndUpdate(
          {
            _id: id,
            status: "submitted",
            $and: [
              { $or: [{ assignedAgent: null }, { assignedAgent: { $exists: false } }] },
              {
                $or: user.serviceAreas.map((area) => ({
                  location: { $regex: area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
                })),
              },
            ],
          },
          {
            $set: { assignedAgent: user.id, status },
            $push: {
              timeline: {
                status,
                note: note || "A verified agent accepted this request.",
                updatedBy: user.id,
              },
            },
          },
          { new: true },
        );
        if (!claimed) return apiError("This request is no longer available to accept.", 409);
        return Response.json({ request: { id: claimed.id, reference: claimed.reference, status } });
      }
    }

    const assignmentFilter = user.role === "agent" ? { assignedAgent: user.id } : {};
    const serviceRequest = await ServiceRequest.findOne({ _id: id, ...assignmentFilter });
    if (!serviceRequest) {
      return user.role === "agent"
        ? apiError("This request is not assigned to you.", 403)
        : apiError("Service request not found.", 404);
    }
    if (user.role === "agent") {
      const currentStatus = serviceRequest.status as RequestStatus;
      if (!agentTransitions[currentStatus].includes(status as RequestStatus)) {
        return apiError("That status change is not allowed from the current step.", 409);
      }
      const updated = await ServiceRequest.findOneAndUpdate(
        { _id: id, assignedAgent: user.id, status: currentStatus },
        {
          $set: { status },
          $push: {
            timeline: {
              status,
              note: note || `Request status updated to ${status.replaceAll("_", " ")}.`,
              updatedBy: user.id,
            },
          },
        },
        { new: true },
      );
      if (!updated) return apiError("The request changed before your update was saved. Refresh and try again.", 409);
      return Response.json({ request: { id: updated.id, reference: updated.reference, status } });
    }

    serviceRequest.status = status as RequestStatus;
    serviceRequest.timeline.push({
      status,
      note: note || `Request status updated to ${status.replaceAll("_", " ")}.`,
      updatedBy: user.id,
    });
    await serviceRequest.save();
    return Response.json({ request: { id: serviceRequest.id, reference: serviceRequest.reference, status } });
  } catch (error) {
    console.error("Request status update failed:", error);
    return apiError("Request status could not be updated.", 503);
  }
}
