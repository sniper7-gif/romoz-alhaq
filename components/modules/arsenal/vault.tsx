"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { btnCls, inputCls } from "@/components/ui/modal";
import { uid } from "@/lib/data";
import { usePersisted } from "@/lib/store";

interface Note {
  id: string;
  title: string;
  body: string;
  at: number;
}
interface Sealed {
  salt: string;
  iv: string;
  ct: string;
}

const ITERATIONS = 600_000;
const MIN_PASS = 8;
const NO_VAULT: Sealed | null = null;

const enc = (s: string) => new TextEncoder().encode(s);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pass: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(key: CryptoKey, salt: Uint8Array, notes: Note[]): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc(JSON.stringify(notes)));
  return { salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export default function Vault() {
  const { t } = useT();
  const [blob, setBlob] = usePersisted<Sealed | null>("vault", NO_VAULT);
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const session = useRef<{ key: CryptoKey; salt: Uint8Array } | null>(null);

  // Key and plaintext live only in memory and are dropped when the tab is left.
  useEffect(() => () => void (session.current = null), []);

  // Vault wiped elsewhere (duress code, other tab): treat it as locked and empty.
  const open = blob ? notes : null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < MIN_PASS) return setErr(t("vaultShort"));
    if (pass !== again) return setErr(t("vaultMismatch"));
    setBusy(true);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(pass, salt);
      session.current = { key, salt };
      setBlob(await seal(key, salt, []));
      setNotes([]);
      setPass("");
      setAgain("");
      setErr("");
    } finally {
      setBusy(false);
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blob) return;
    setBusy(true);
    try {
      const salt = unb64(blob.salt);
      const key = await deriveKey(pass, salt);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) as BufferSource }, key, unb64(blob.ct) as BufferSource);
      session.current = { key, salt };
      setNotes(JSON.parse(new TextDecoder().decode(plain)));
      setPass("");
      setErr("");
    } catch {
      setErr(t("vaultWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function commit(next: Note[]) {
    const s = session.current;
    if (!s) return;
    setBlob(await seal(s.key, s.salt, next));
    setNotes(next);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!notes || !body.trim()) return;
    await commit([{ id: uid(), title: title.trim() || "—", body: body.trim(), at: Date.now() }, ...notes]);
    setTitle("");
    setBody("");
  }

  function lock() {
    session.current = null;
    setNotes(null);
  }

  function wipe() {
    if (!window.confirm(t("vaultWipeConfirm"))) return;
    lock();
    setBlob(null);
  }

  if (open === null) {
    const creating = !blob;
    return (
      <form onSubmit={creating ? create : unlock} className="max-w-sm space-y-3" noValidate>
        <p className="text-xs text-dim">{t(creating ? "vaultCreateIntro" : "vaultLockedIntro")}</p>
        <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t("vaultPass")} aria-label={t("vaultPass")} className={inputCls} />
        {creating && (
          <input type="password" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} placeholder={t("vaultPassAgain")} aria-label={t("vaultPassAgain")} className={inputCls} />
        )}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy || !pass} className={btnCls}>
            {busy ? t("vaultDeriving") : t(creating ? "vaultCreate" : "vaultUnlock")}
          </button>
          {!creating && (
            <button type="button" onClick={wipe} className={`${btnCls} border-danger text-danger hover:bg-danger/10`}>
              {t("vaultWipe")}
            </button>
          )}
        </div>
        {creating && <p className="text-[11px] text-warn">{t("vaultNoRecovery")}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-accent">🔓 {t("vaultOpen")} · {open.length}</span>
        <button type="button" onClick={lock} className={btnCls}>
          {t("vaultLock")}
        </button>
      </div>
      <form onSubmit={add} className="space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("vaultNoteTitle")} maxLength={80} className={inputCls} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("vaultNoteBody")} rows={4} maxLength={5000} className={`${inputCls} resize-y`} />
        <button type="submit" disabled={!body.trim()} className={btnCls}>
          {t("vaultSave")}
        </button>
      </form>
      <ul className="space-y-2">
        {open.map((n) => (
          <li key={n.id} className="border border-line bg-black/40 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <strong className="truncate text-accent">{n.title}</strong>
              <button type="button" onClick={() => commit(open.filter((x) => x.id !== n.id))} aria-label={t("delete")} className="text-dim hover:text-danger">
                ✕
              </button>
            </div>
            <p className="whitespace-pre-wrap break-words">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
