import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Service } from "@/lib/models";

async function requireAdmin(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { error: apiError("Sign in to manage services.", 401) };
  if (user.role !== "admin") return { error: apiError("Administrator access is required.", 403) };
  return { user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    await connectToDatabase();
    const services = await Service.find({})
      .select("-__v -createdAt -updatedAt")
      .sort({ category: 1, name: 1 })
      .lean();
    return Response.json({ services });
  } catch (error) {
    console.error("Admin service lookup failed:", error);
    return apiError("Service records are temporarily unavailable.", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const slug = typeof body.slug === "string" ? body.slug : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const requiredDocuments = Array.isArray(body.requiredDocuments)
      ? body.requiredDocuments.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
      : [];
    const governmentFee = body.governmentFee;
    const assistanceFee = body.assistanceFee;
    const estimatedDays = body.estimatedDays;

    if (
      !slug ||
      name.length < 2 ||
      name.length > 100 ||
      category.length < 2 ||
      category.length > 100 ||
      description.length < 2 ||
      description.length > 1000 ||
      !Array.isArray(body.requiredDocuments) ||
      requiredDocuments.length > 20 ||
      requiredDocuments.some((item) => item.length > 120) ||
      typeof governmentFee !== "number" ||
      !Number.isInteger(governmentFee) ||
      governmentFee < 0 ||
      governmentFee > 10000000 ||
      typeof assistanceFee !== "number" ||
      !Number.isInteger(assistanceFee) ||
      assistanceFee < 0 ||
      assistanceFee > 10000000 ||
      typeof estimatedDays !== "number" ||
      !Number.isInteger(estimatedDays) ||
      estimatedDays < 1 ||
      estimatedDays > 365
    ) {
      return apiError("Check service name, category, documents, fees, and estimated days.", 400);
    }

    await connectToDatabase();
    const service = await Service.findOneAndUpdate(
      { slug },
      { name, category, description, requiredDocuments, governmentFee, assistanceFee, estimatedDays },
      { new: true, runValidators: true },
    ).select("-__v -createdAt -updatedAt");
    if (!service) return apiError("Service not found.", 404);
    return Response.json({ service });
  } catch (error) {
    console.error("Service details update failed:", error);
    return apiError("Service details could not be updated.", 503);
  }
}
