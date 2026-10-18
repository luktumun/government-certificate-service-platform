import { assertSessionConfiguration, createSessionCookie, hashPassword } from "@/lib/auth";
import { apiError, isValidEmail } from "@/lib/api";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (name.length < 2 || name.length > 100 || !isValidEmail(email) || password.length < 8 || password.length > 128) {
      return apiError("Enter a name, a valid email, and a password of at least 8 characters.", 400);
    }
    if (phone && !/^[+\d][\d\s()-]{7,23}$/.test(phone)) {
      return apiError("Enter a valid phone number.", 400);
    }

    assertSessionConfiguration();
    await connectToDatabase();
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      role: "citizen",
    });
    if (!user) return apiError("Account could not be created.", 503);
    const response = Response.json(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      { status: 201 },
    );
    response.headers.set("Set-Cookie", createSessionCookie(user.id));
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return apiError("An account with that email already exists.", 409);
    }
    console.error("Registration failed:", error);
    return apiError("Registration is temporarily unavailable.", 503);
  }
}
