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

const secret = () => {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_JWT_SECRET missing");
  return new TextEncoder().encode(s);
};

export function roleForPasscode(passcode: string): Role | null {
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

/** Naive in-memory limiter for login attempts (per instance). */
const attempts = new Map<string, { n: number; t: number }>();
export function rateLimited(key: string, max = 8, windowMs = 60_000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > windowMs) {
    attempts.set(key, { n: 1, t: now });
    return false;
  }
  a.n++;
  return a.n > max;
}
