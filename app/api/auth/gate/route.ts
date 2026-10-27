import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions, roleForPasscode, signSession } from "@/lib/auth";

/** Gate 1: the access code only unlocks Gate 2. The cookie has no codename yet. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const role = roleForPasscode(String(body?.passcode ?? ""));
  if (!role) return NextResponse.json({ error: "ACCESS DENIED" }, { status: 401 });

  const res = NextResponse.json({ role });
  res.cookies.set(COOKIE_NAME, await signSession({ codename: "", role }), cookieOptions);
  return res;
}
