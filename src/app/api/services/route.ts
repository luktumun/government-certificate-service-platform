import { connectToDatabase } from "@/lib/db";
import { Service } from "@/lib/models";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const category = searchParams.get("category")?.trim();
  const search = searchParams.get("q")?.trim();
  try {
    await connectToDatabase();
    const filter = {
      active: true,
      ...(category ? { category } : {}),
      ...(search
        ? {
            $or: [
              { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
              { category: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
              { description: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
              { requiredDocuments: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            ],
          }
        : {}),
    };
    const services = await Service.find(filter)
      .select("-__v -createdAt -updatedAt -active")
      .sort({ category: 1, name: 1 })
      .lean();
    return Response.json({ services });
  } catch (error) {
    console.error("Service catalog lookup failed:", error);
    return Response.json({ error: "The service catalog is temporarily unavailable." }, { status: 503 });
  }
}
