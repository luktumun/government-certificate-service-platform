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
    const serviceAreas = Array.isArray(body.serviceAreas)
      ? body.serviceAreas.filter((area): area is string => typeof area === "string").map((area) => area.trim()).filter(Boolean).slice(0, 10)
      : [];

    if (name.length < 2 || name.length > 100 || !isValidEmail(email) || password.length < 8 || password.length > 128) {
      return apiError("Enter a name, a valid email, and a password of at least 8 characters.", 400);
    }
    if (!/^[+\d][\d\s()-]{7,23}$/.test(phone)) {
      return apiError("Enter a valid phone number.", 400);
    }
    if (serviceAreas.length === 0 || serviceAreas.some((area) => area.length > 100)) {
      return apiError("Add at least one service area.", 400);
    }

    assertSessionConfiguration();
    await connectToDatabase();
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      role: "agent",
      verificationStatus: "pending",
      serviceAreas,
    });
    if (!user) return apiError("Agent account could not be created.", 503);
    const response = Response.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          verificationStatus: user.verificationStatus,
        },
      },
      { status: 201 },
    );
    response.headers.set("Set-Cookie", createSessionCookie(user.id));
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return apiError("An account with that email already exists.", 409);
    }
    console.error("Agent registration failed:", error);
    return apiError("Agent registration is temporarily unavailable.", 503);
  }
}
