import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";

export async function GET(request: Request) {
  try {
    const admin = await getSessionUser(request);
    if (!admin) return apiError("Sign in to manage agents.", 401);
    if (admin.role !== "admin") return apiError("Administrator access is required.", 403);
    await connectToDatabase();
    const agents = await User.find({ role: "agent" })
      .select("name email phone serviceAreas verificationStatus createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return Response.json({ agents });
  } catch (error) {
    console.error("Agent list lookup failed:", error);
    return apiError("Agent records are temporarily unavailable.", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await getSessionUser(request);
    if (!admin) return apiError("Sign in to manage agents.", 401);
    if (admin.role !== "admin") return apiError("Administrator access is required.", 403);
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.agentId === "string" ? body.agentId : "";
    const verificationStatus = body.verificationStatus;
    if (!id || (verificationStatus !== "verified" && verificationStatus !== "rejected")) {
      return apiError("Choose an agent and a valid verification decision.", 400);
    }

    await connectToDatabase();
    const agent = await User.findOneAndUpdate(
      { _id: id, role: "agent" },
      { verificationStatus },
      { new: true },
    ).select("name email verificationStatus");
    if (!agent) return apiError("Agent not found.", 404);
    return Response.json({ agent });
  } catch (error) {
    console.error("Agent verification update failed:", error);
    return apiError("Agent verification could not be updated.", 503);
  }
}
