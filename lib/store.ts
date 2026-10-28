"use client";
import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "rah:";
const subs = new Set<() => void>();
const parsed = new Map<string, { raw: string | null; val: unknown }>();
const emit = () => subs.forEach((f) => f());

// Keys mirrored to the server (/api/sync) so PC and phone share one state. Last write wins.
const SYNCED = (k: string) => ["chat", "reports", "alerts", "missions", "threats-v2"].includes(k) || k.startsWith("profile:");
const stamps = new Map<string, number>();
const dirty = new Set<string>();
let lastSeen = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;

function applyRemote(key: string, val: unknown, t: number) {
  const raw = JSON.stringify(val);
  stamps.set(key, t);
  dirty.delete(key);
  parsed.set(key, { raw, val });
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* blocked: memory cache still updates */
  }
}

async function flush() {
  for (const key of [...dirty]) {
    const hit = parsed.get(key);
    if (!hit) continue;
    try {
      const res = await fetch("/api/sync", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ k: key, v: hit.val }) });
      if (res.ok) {
        const { t } = (await res.json()) as { t: number };
        stamps.set(key, t);
        lastSeen = Math.max(lastSeen, t);
        dirty.delete(key);
      } else if (res.status === 401 || res.status === 403 || res.status === 413) dirty.delete(key);
    } catch {
      /* offline: stays dirty and retries on the next tick */
    }
  }
}

async function tick() {
  if (busy || document.hidden) return;
  busy = true;
  try {
    await flush();
    const res = await fetch(`/api/sync?since=${lastSeen}`, { cache: "no-store" });
    if (!res.ok) return;
    const { items } = (await res.json()) as { items: { k: string; v: unknown; t: number }[] };
    let changed = false;
    for (const it of items) {
      lastSeen = Math.max(lastSeen, it.t);
      if (dirty.has(it.k) || (stamps.get(it.k) ?? 0) >= it.t) continue;
      applyRemote(it.k, it.v, it.t);
      changed = true;
    }
    if (changed) emit();
  } catch {
    /* network error: try again next tick */
  } finally {
    busy = false;
  }
}

/** Starts the cross-device sync loop once per page. Safe to call repeatedly. */
export function startSync() {
  if (timer || typeof window === "undefined") return;
  void tick();
  timer = setInterval(tick, 3000);
  document.addEventListener("visibilitychange", () => !document.hidden && void tick());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  const onStorage = (e: StorageEvent) => (e.key === null || e.key.startsWith(PREFIX)) && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function read<T>(key: string, initial: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    /* storage blocked: fall back to the cached value */
  }
  const hit = parsed.get(key);
  if (hit && (hit.raw === raw || raw === null)) return hit.val as T;
  let val = initial;
  if (raw !== null) {
    try {
      val = JSON.parse(raw);
    } catch {
      /* corrupt entry: use initial */
    }
  }
  parsed.set(key, { raw, val });
  return val;
}

/** localStorage-backed state shared across components and tabs. `initial` must be a stable reference. */
export function usePersisted<T>(key: string, initial: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, initial),
    () => initial,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, initial);
      const val = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      const raw = JSON.stringify(val);
      parsed.set(key, { raw, val });
      try {
        localStorage.setItem(PREFIX + key, raw);
      } catch {
        /* quota or blocked: state still lives in memory for this session */
      }
      if (SYNCED(key)) dirty.add(key);
      emit();
      if (SYNCED(key)) void tick();
    },
    [key, initial],
  );
  return [value, set] as const;
}
