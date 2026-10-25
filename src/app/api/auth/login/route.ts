import { assertSessionConfiguration, createSessionCookie, verifyPassword } from "@/lib/auth";
import { apiError, isValidEmail } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!isValidEmail(email) || !password) return apiError("Email or password is incorrect.", 401);

    assertSessionConfiguration();
    await connectToDatabase();
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return apiError("Email or password is incorrect.", 401);
    }

    const response = Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        verificationStatus: user.verificationStatus,
      },
    });
    response.headers.set("Set-Cookie", createSessionCookie(user.id));
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return apiError(
      "Sign in is unavailable. The site administrator must configure a reachable MongoDB database and a JWT_SECRET of at least 32 characters.",
      503,
    );
  }
}
