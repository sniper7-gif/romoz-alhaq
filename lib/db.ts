import { Pool } from "pg";

// Shared key/value store behind /api/sync and member accounts. Postgres (Supabase pooler) when
// DATABASE_URL works, otherwise a per-instance memory map so the app still runs.
const POOLER_HOST = process.env.SUPABASE_POOLER_HOST ?? "aws-0-eu-west-1.pooler.supabase.com";

export interface Row {
  k: string;
  v: unknown;
  t: number;
}

const mem = new Map<string, Row>();
let pool: Pool | null | undefined;
let ready: Promise<void> | null = null;

function getPool() {
  if (pool !== undefined) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) return (pool = null);
  try {
    const u = new URL(raw);
    // The direct host is IPv6-only and unreachable from most serverless runtimes: use the pooler.
    const ref = u.hostname.startsWith("db.") ? u.hostname.split(".")[1] : null;
    pool = new Pool(
      ref
        ? { host: POOLER_HOST, port: 5432, user: `postgres.${ref}`, password: decodeURIComponent(u.password), database: "postgres", ssl: { rejectUnauthorized: false }, max: 3 }
        : { connectionString: raw, ssl: { rejectUnauthorized: false }, max: 3 },
    );
    pool.on("error", () => {});
  } catch {
    pool = null;
  }
  return pool;
}

async function db() {
  const p = getPool();
  if (!p) return null;
  ready ??= p
    .query("create table if not exists rah_kv(k text primary key, v jsonb not null, t bigint not null)")
    .then(() => void p.query("alter table rah_kv enable row level security").catch(() => {}));
  try {
    await ready;
    return p;
  } catch {
    ready = null;
    return null;
  }
}

const norm = (r: { k: string; v: unknown; t: string | number }): Row => ({ k: r.k, v: r.v, t: Number(r.t) });

export async function listSince(since: number, prefixes: string[]): Promise<Row[]> {
  const p = await db();
  if (p) {
    try {
      const { rows } = await p.query("select k, v, t from rah_kv where t > $1 and k like any($2)", [since, prefixes.map((x) => `${x}%`)]);
      return rows.map(norm);
    } catch {
      /* fall through to memory */
    }
  }
  return [...mem.values()].filter((r) => r.t > since && prefixes.some((x) => r.k.startsWith(x)));
}

export async function getRow(k: string): Promise<Row | null> {
  const p = await db();
  if (p) {
    try {
      const { rows } = await p.query("select k, v, t from rah_kv where k = $1", [k]);
      return rows[0] ? norm(rows[0]) : null;
    } catch {
      /* fall through */
    }
  }
  return mem.get(k) ?? null;
}

export async function putRow(k: string, v: unknown): Promise<number> {
  const t = Date.now();
  const p = await db();
  if (p) {
    try {
      await p.query("insert into rah_kv(k, v, t) values ($1, $2::jsonb, $3) on conflict (k) do update set v = excluded.v, t = excluded.t", [k, JSON.stringify(v), t]);
      return t;
    } catch {
      /* fall through */
    }
  }
  mem.set(k, { k, v, t });
  return t;
}

/** Atomic insert-if-absent; false when the key already exists (duplicate registration). */
export async function insertOnce(k: string, v: unknown): Promise<boolean> {
  const t = Date.now();
  const p = await db();
  if (p) {
    try {
      const r = await p.query("insert into rah_kv(k, v, t) values ($1, $2::jsonb, $3) on conflict (k) do nothing", [k, JSON.stringify(v), t]);
      return (r.rowCount ?? 0) > 0;
    } catch {
      /* fall through */
    }
  }
  if (mem.has(k)) return false;
  mem.set(k, { k, v, t });
  return true;
}
