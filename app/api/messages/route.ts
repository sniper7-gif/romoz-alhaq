import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const B64 = /^[A-Za-z0-9+/=]+$/;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const after = req.nextUrl.searchParams.get("after");
  const sb = supabaseAdmin();
  const { data, error } = after
    ? await sb.from("messages").select("*").gt("created_at", after).order("created_at", { ascending: true }).limit(200)
    : await sb.from("messages").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(after ? data : (data ?? []).reverse());
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const cipher_text = b?.cipher_text ? String(b.cipher_text) : null;
  const iv = b?.iv ? String(b.iv) : null;
  const audio_url = b?.audio_url ? String(b.audio_url) : null;
  if (!cipher_text && !audio_url) return NextResponse.json({ error: "EMPTY" }, { status: 400 });
  if (cipher_text && (!iv || !B64.test(cipher_text) || !B64.test(iv) || cipher_text.length > 20000)) {
    return NextResponse.json({ error: "BAD PAYLOAD" }, { status: 400 });
  }
  if (audio_url && !/^[0-9a-f-]{36}\.bin$/.test(audio_url)) {
    return NextResponse.json({ error: "BAD AUDIO" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin()
    .from("messages")
    .insert({ sender_codename: s.codename, role: s.role, cipher_text, iv, audio_url })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
