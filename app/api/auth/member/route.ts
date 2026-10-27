import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions, getSession, signSession } from "@/lib/auth";

/** Gate 2: upgrades a gate-stage session to a full session carrying the member's codename. */
export async function POST(req: NextRequest) {
  const gate = await getSession();
  if (!gate) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const codename = String(body?.codename ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_\- ]{2,24}$/.test(codename)) return NextResponse.json({ error: "INVALID CODENAME" }, { status: 400 });

  const res = NextResponse.json({ codename, role: gate.role });
  res.cookies.set(COOKIE_NAME, await signSession({ codename, role: gate.role }), cookieOptions);
  return res;
}
