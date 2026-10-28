import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "OFFICER" | "SOLDIER";
export interface Session {
  codename: string;
  role: Role;
}

export const COOKIE_NAME = "rah_session";
const MAX_AGE = 60 * 60 * 12;

// The fallback keeps login working if AUTH_JWT_SECRET is unset. It is public in the repo,
// so set AUTH_JWT_SECRET in production or session cookies can be forged.
const FALLBACK_SECRET = "romoz-alhaq-ultra-secret-tactical-key-2026-x99";
const secret = () => {
  const s = process.env.AUTH_JWT_SECRET;
  return new TextEncoder().encode(s && s.length >= 32 ? s : FALLBACK_SECRET);
};

const PASSCODES: Record<string, Role> = { "77777773": "OFFICER", "3337": "SOLDIER" };
/** Silent duress code: wipes local data and opens the decoy. Never reveals itself as a failed login. */
export const DURESS_CODE = "7777777";
export const roleForPasscode = (raw: string): Role | null => PASSCODES[raw.trim()] ?? null;

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
    if ((payload.role !== "OFFICER" && payload.role !== "SOLDIER") || typeof payload.codename !== "string") return null;
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
