import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = Response.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie(request));
  return response;
}
