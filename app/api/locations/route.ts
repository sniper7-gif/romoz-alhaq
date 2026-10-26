import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (s.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { data, error } = await supabaseAdmin().from("locations").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const lat = num(b?.lat);
  const lng = num(b?.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "BAD COORDS" }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await sb.from("locations").upsert(
    { user_codename: s.codename, role: s.role, lat, lng, accuracy: num(b.accuracy), heading: num(b.heading), speed: num(b.speed), updated_at: now },
    { onConflict: "user_codename" },
  );
  await sb.from("active_sessions").update({ last_seen: now }).eq("user_codename", s.codename);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
