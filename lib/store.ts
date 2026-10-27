"use client";
import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "rah:";
const subs = new Set<() => void>();
const parsed = new Map<string, { raw: string | null; val: unknown }>();
const emit = () => subs.forEach((f) => f());

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
      emit();
    },
    [key, initial],
  );
  return [value, set] as const;
}
