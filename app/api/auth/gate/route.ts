import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, DURESS_CODE, cookieOptions, roleForPasscode, signSession } from "@/lib/auth";

/** Gate 1: the access code only unlocks Gate 2. The cookie has no codename yet. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = String(body?.passcode ?? "");
  if (code.trim() === DURESS_CODE) {
    const res = NextResponse.json({ duress: true });
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
  const role = roleForPasscode(code);
  if (!role) return NextResponse.json({ error: "ACCESS DENIED" }, { status: 401 });

  const res = NextResponse.json({ role });
  res.cookies.set(COOKIE_NAME, await signSession({ codename: "", role }), cookieOptions);
  return res;
}
