import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export type Role = "ADMIN" | "MEMBER";
export interface Session {
  codename: string;
  role: Role;
}

export const COOKIE_NAME = "rah_session";
const MAX_AGE = 60 * 60 * 12;

// Fallback keeps login working if AUTH_JWT_SECRET is unset. It is public in the repo:
// set AUTH_JWT_SECRET in production, otherwise session cookies can be forged.
const FALLBACK_SECRET = "romoz-alhaq-fallback-secret-change-me-0123456789";
const secret = () => {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s || s.length < 32) console.warn("AUTH_JWT_SECRET missing or short; using insecure fallback");
  return new TextEncoder().encode(s && s.length >= 32 ? s : FALLBACK_SECRET);
};

export function roleForPasscode(raw: string): Role | null {
  const passcode = raw.trim();
  if (passcode === "77777773") return "ADMIN";
  if (passcode === "3337") return "MEMBER";
  return null;
}

export async function signSession(s: Session) {
  return new SignJWT({ codename: s.codename, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if ((payload.role !== "ADMIN" && payload.role !== "MEMBER") || typeof payload.codename !== "string") return null;
    return { codename: payload.codename, role: payload.role };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: MAX_AGE,
};

export async function getSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(COOKIE_NAME)?.value);
}

export async function getSessionFromRequest(req: NextRequest) {
  return verifyToken(req.cookies.get(COOKIE_NAME)?.value);
}
