import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { connectToDatabase } from "@/lib/db";
import { User, type UserRole } from "@/lib/models";

const scryptAsync = promisify(scrypt);
const cookieName = "janseva_token";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const jwtIssuer = "janseva";
const jwtAudience = "janseva-platform";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  verificationStatus?: "pending" | "verified" | "rejected";
  serviceAreas: string[];
};

function getSessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export function assertSessionConfiguration() {
  getSessionSecret();
}

function usesSecureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  return forwardedProtocol ? forwardedProtocol === "https" : new URL(request.url).protocol === "https:";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedKey] = passwordHash.split(":");
  if (!salt || !storedKey || !/^[a-f0-9]{128}$/i.test(storedKey)) return false;

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(storedKey, "hex");
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

function signJwt(unsignedToken: string) {
  return createHmac("sha256", getSessionSecret()).update(unsignedToken).digest("base64url");
}

export function createSessionCookie(userId: string, request: Request) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    iss: jwtIssuer,
    aud: jwtAudience,
    iat: issuedAt,
    exp: issuedAt + sessionLifetimeSeconds,
  })).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const value = `${unsignedToken}.${signJwt(unsignedToken)}`;
  const secure = usesSecureCookie(request) ? "; Secure" : "";
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetimeSeconds}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = usesSecureCookie(request) ? "; Secure" : "";
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  if (!token) return null;

  const [header, payload, signature, extra] = token.split(".");
  if (!header || !payload || !signature || extra) return null;

  const unsignedToken = `${header}.${payload}`;
  const expected = Buffer.from(signJwt(unsignedToken));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let session: { sub?: string; iss?: string; aud?: string; iat?: number; exp?: number };
  try {
    const jwtHeader = JSON.parse(Buffer.from(header, "base64url").toString()) as {
      alg?: string;
      typ?: string;
    };
    if (jwtHeader.alg !== "HS256" || jwtHeader.typ !== "JWT") return null;
    session = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: string;
      iss?: string;
      aud?: string;
      iat?: number;
      exp?: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (
      !session.sub ||
      session.iss !== jwtIssuer ||
      session.aud !== jwtAudience ||
      !session.iat ||
      session.iat > now ||
      !session.exp ||
      session.exp <= now
    ) return null;
  } catch {
    return null;
  }

  await connectToDatabase();
  const user = await User.findById(session.sub).select("name email role verificationStatus serviceAreas");
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    verificationStatus: user.verificationStatus,
    serviceAreas: user.serviceAreas,
  };
}
