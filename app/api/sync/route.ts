import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listSince, putRow } from "@/lib/db";

// Keys shared across devices (stored as `s:<key>`). Account records (acct:*) are never exposed here.
const SHARED = ["chat", "reports", "alerts", "missions", "threats-v2", "profile:"];
const MAX_BYTES = 3_500_000;
const isShared = (k: string) => SHARED.some((s) => (s.endsWith(":") ? k.startsWith(s) : k === s));

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.codename) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const since = Number(req.nextUrl.searchParams.get("since")) || 0;
  const rows = await listSince(since, SHARED.map((x) => `s:${x}`));
  return NextResponse.json({ items: rows.map((r) => ({ k: r.k.slice(2), v: r.v, t: r.t })) });
}

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s?.codename) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
  let body: { k?: unknown; v?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    /* rejected below */
  }
  const k = typeof body?.k === "string" ? body.k : "";
  if (!isShared(k) || body?.v === undefined) return NextResponse.json({ error: "BAD_KEY" }, { status: 400 });
  // A member may only write their own profile.
  if (k.startsWith("profile:") && k !== `profile:${s.codename}`) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const t = await putRow(`s:${k}`, body.v);
  return NextResponse.json({ t });
}
