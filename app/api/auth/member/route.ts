import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions, getSession, signSession } from "@/lib/auth";
import { getRow, insertOnce } from "@/lib/db";

const derive = (pw: string, salt: Buffer) => pbkdf2Sync(pw, salt, 150_000, 32, "sha256");

/** Gate 2: registers or verifies a shared account, then upgrades the session to carry the codename. */
export async function POST(req: NextRequest) {
  const gate = await getSession();
  if (!gate) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const codename = String(body?.codename ?? "").trim().toUpperCase();
  const password = String(body?.password ?? "");
  const mode = body?.mode === "register" ? "register" : "login";
  if (!/^[A-Z0-9_\- ]{2,24}$/.test(codename)) return NextResponse.json({ error: "badCodename" }, { status: 400 });
  if (password.length < 6 || password.length > 200) return NextResponse.json({ error: "shortPassword" }, { status: 400 });

  const key = `acct:${codename}`;
  if (mode === "register") {
    const salt = randomBytes(16);
    const ok = await insertOnce(key, { salt: salt.toString("base64"), hash: derive(password, salt).toString("base64") });
    if (!ok) return NextResponse.json({ error: "codenameTaken" }, { status: 409 });
  } else {
    const acc = (await getRow(key))?.v as { salt: string; hash: string } | undefined;
    let good = false;
    if (acc) {
      const a = derive(password, Buffer.from(acc.salt, "base64"));
      const b = Buffer.from(acc.hash, "base64");
      good = a.length === b.length && timingSafeEqual(a, b);
    }
    if (!good) return NextResponse.json({ error: "badCredentials" }, { status: 401 });
  }

  const res = NextResponse.json({ codename, role: gate.role });
  res.cookies.set(COOKIE_NAME, await signSession({ codename, role: gate.role }), cookieOptions);
  return res;
}
