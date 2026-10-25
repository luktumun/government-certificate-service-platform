import mongoose from "mongoose";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ServiceRequest, UploadedFile } from "@/lib/models";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const user = await getSessionUser(request);
    if (!user) return apiError("Sign in to download documents.", 401);
    if (user.role === "agent" && user.verificationStatus !== "verified") {
      return apiError("Your agent account must be verified first.", 403);
    }
    const { id, documentId } = await context.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(documentId)) {
      return apiError("Document not found.", 404);
    }
    await connectToDatabase();
    const serviceRequest = await ServiceRequest.findById(id).select("+documents.storageKey");
    if (!serviceRequest) return apiError("Service request not found.", 404);

    const ownsRequest = serviceRequest.citizen?.equals(user.id) ?? false;
    const assignedAgent = serviceRequest.assignedAgent?.equals(user.id) ?? false;
    if (!ownsRequest && !assignedAgent && user.role !== "admin") {
      return apiError("You cannot access these documents.", 403);
    }

    const document = serviceRequest.documents.id(documentId);
    if (!document) return apiError("Document not found.", 404);
    const uploadedFile = await UploadedFile.findOne({ storageKey: document.storageKey }).select("+content");
    if (!uploadedFile) return apiError("Document file not found.", 404);
    const filename = document.originalName.replace(/["\r\n]/g, "_");
    const bytes = new Uint8Array(uploadedFile.content);
    return new Response(bytes, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Document download failed:", error);
    return apiError("Document could not be downloaded.", 503);
  }
}
