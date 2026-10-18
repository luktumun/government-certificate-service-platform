import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  if (new URL(request.url).pathname !== "/api/auth/me") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const user = await getSessionUser(request);
    return Response.json({ user });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return Response.json({ error: "Session service is temporarily unavailable." }, { status: 503 });
  }
}
