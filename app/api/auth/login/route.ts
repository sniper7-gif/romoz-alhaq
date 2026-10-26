import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions, rateLimited, roleForPasscode, signSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "TOO MANY ATTEMPTS" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const codename = String(body?.codename ?? "").trim().toUpperCase();
  const passcode = String(body?.passcode ?? "");
  if (!/^[A-Z0-9_\- ]{2,24}$/.test(codename)) {
    return NextResponse.json({ error: "INVALID CODENAME" }, { status: 400 });
  }
  const role = roleForPasscode(passcode);
  if (!role) return NextResponse.json({ error: "ACCESS DENIED" }, { status: 401 });

  await supabaseAdmin()
    .from("active_sessions")
    .upsert({ user_codename: codename, role, last_seen: new Date().toISOString() }, { onConflict: "user_codename" });

  const res = NextResponse.json({ codename, role });
  res.cookies.set(COOKIE_NAME, await signSession({ codename, role }), cookieOptions);
  return res;
}
