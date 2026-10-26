import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const MAX = 8 * 1024 * 1024;

/** Upload an already client-encrypted audio blob. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength < 13 || buf.byteLength > MAX) return NextResponse.json({ error: "BAD SIZE" }, { status: 400 });
  const path = `${crypto.randomUUID()}.bin`;
  const { error } = await supabaseAdmin()
    .storage.from("voice-messages")
    .upload(path, buf, { contentType: "application/octet-stream" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path });
}

/** Fetch an encrypted blob (still ciphertext) for authenticated users. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!/^[0-9a-f-]{36}\.bin$/.test(path)) return NextResponse.json({ error: "BAD PATH" }, { status: 400 });
  const { data, error } = await supabaseAdmin().storage.from("voice-messages").download(path);
  if (error || !data) return NextResponse.json({ error: "NOT FOUND" }, { status: 404 });
  return new NextResponse(await data.arrayBuffer(), {
    headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=3600" },
  });
}
