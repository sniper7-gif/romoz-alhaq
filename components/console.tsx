"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Session } from "@/lib/auth";
import { decryptBlob, decryptText, deriveKey, encryptBlob, encryptText, keyStore } from "@/lib/crypto";
import { alertSiren, radioCue, staticBurst, unlockAudio } from "@/lib/radio-fx";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useQuakes, WorldMonitor } from "@/components/world-monitor";
import type { MemberPos } from "@/components/radar-map";

const RadarMap = dynamic(() => import("@/components/radar-map"), { ssr: false });

interface Row {
  id: string;
  sender_codename: string;
  role: "ADMIN" | "MEMBER";
  cipher_text: string | null;
  iv: string | null;
  audio_url: string | null;
  created_at: string;
}
interface Msg extends Row {
  text?: string;
  kind: "chat" | "alert" | "voice";
}
interface Online {
  codename: string;
  role: "ADMIN" | "MEMBER";
}

type Tab = "comms" | "radar" | "monitor";
const CHANNEL = "rah-comms";

export default function Console({ session }: { session: Session }) {
  const router = useRouter();
  const isAdmin = session.role === "ADMIN";
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState<Tab>("comms");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [online, setOnline] = useState<Online[]>([]);
  const [talkers, setTalkers] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<Record<string, MemberPos>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [transmitting, setTransmitting] = useState(false);
  const [error, setError] = useState("");
  const { quakes, status: quakeStatus } = useQuakes();

  const keyRef = useRef<CryptoKey | null>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const lastRef = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const queue = useRef<Msg[]>([]);
  const playing = useRef(false);
  const recorder = useRef<{ mr: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null);

  const sealed = useCallback(async (obj: unknown) => encryptText(keyRef.current!, JSON.stringify(obj)), []);
  const send = useCallback(
    async (event: string, payload: unknown) => {
      if (!chRef.current || !keyRef.current) return;
      await chRef.current.send({ type: "broadcast", event, payload: await sealed(payload) });
    },
    [sealed],
  );

  const playQueue = useCallback(async () => {
    if (playing.current) return;
    playing.current = true;
    while (queue.current.length) {
      const m = queue.current.shift()!;
      try {
        const res = await fetch(`/api/voice?path=${encodeURIComponent(m.audio_url!)}`);
        if (!res.ok) continue;
        const plain = await decryptBlob(keyRef.current!, await res.arrayBuffer());
        const url = URL.createObjectURL(new Blob([plain], { type: "audio/webm" }));
        await radioCue();
        await new Promise<void>((done) => {
          const a = new Audio(url);
          a.onended = () => done();
          a.onerror = () => done();
          a.play().catch(() => done());
        });
        URL.revokeObjectURL(url);
        await staticBurst();
      } catch {
        /* skip undecryptable clip */
      }
    }
    playing.current = false;
  }, []);

  const ingest = useCallback(
    async (rows: Row[], live: boolean) => {
      const out: Msg[] = [];
      for (const r of rows) {
        if (!r?.id || seen.current.has(r.id)) continue;
        if (!r.audio_url && (!r.cipher_text || !r.iv)) continue;
        seen.current.add(r.id);
        lastRef.current = r.created_at;
        let m: Msg;
        if (r.audio_url) m = { ...r, kind: "voice" };
        else {
          const raw = await decryptText(keyRef.current!, r.cipher_text!, r.iv!);
          let kind: Msg["kind"] = "chat";
          let text = raw;
          try {
            const j = JSON.parse(raw);
            if (j && typeof j.text === "string") {
              text = j.text;
              // Alerts are trusted only when the server stamped the row as ADMIN.
              if (j.t === "alert" && r.role === "ADMIN") kind = "alert";
            }
          } catch {
            /* plain text */
          }
          m = { ...r, text, kind };
        }
        out.push(m);
        if (live && r.sender_codename !== session.codename) {
          if (m.kind === "voice") {
            queue.current.push(m);
            void playQueue();
          } else if (m.kind === "alert") {
            setAlert(m.text ?? "");
            alertSiren();
            setTimeout(() => setAlert(null), 15000);
          }
        }
      }
      if (out.length) setMsgs((p) => [...p, ...out].slice(-300));
    },
    [playQueue, session.codename],
  );

  const pull = useCallback(async () => {
    const res = await fetch(lastRef.current ? `/api/messages?after=${encodeURIComponent(lastRef.current)}` : "/api/messages");
    if (!res.ok) return;
    const rows = await res.json().catch(() => null);
    if (Array.isArray(rows)) await ingest(rows, !!lastRef.current);
  }, [ingest]);

  // Activation: unlock audio, derive key, join realtime.
  async function activate() {
    unlockAudio();
    const pass = keyStore.get();
    if (!pass) {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      return;
    }
    keyRef.current = await deriveKey(pass);
    setActive(true);
  }

  useEffect(() => {
    if (!active) return;
    const sb = supabaseBrowser();
    const ch = sb.channel(CHANNEL, { config: { presence: { key: session.codename }, broadcast: { self: false } } });
    chRef.current = ch;

    const open = async (payload: { cipher_text: string; iv: string }) => {
      try {
        return JSON.parse(await decryptText(keyRef.current!, payload.cipher_text, payload.iv));
      } catch {
        return null;
      }
    };

    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<Online>();
      setOnline(Object.values(st).flatMap((v) => v.map((x) => ({ codename: x.codename, role: x.role }))));
    })
      .on("broadcast", { event: "TALK" }, async ({ payload }) => {
        const d = await open(payload);
        if (!d?.codename) return;
        setTalkers((t) => {
          const n = { ...t };
          if (d.talking) n[d.codename] = Date.now();
          else delete n[d.codename];
          return n;
        });
      })
      .on("broadcast", { event: "MSG" }, () => void pull())
      .on("broadcast", { event: "LOC" }, async ({ payload }) => {
        const d = await open(payload);
        if (!d || !isAdmin || typeof d.lat !== "number") return;
        setMembers((m) => ({ ...m, [d.codename]: { ...d, updated_at: new Date().toISOString() } }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ codename: session.codename, role: session.role });
      });

    void pull();
    const poll = setInterval(() => void pull(), 15000);
    const sweep = setInterval(
      () => setTalkers((t) => Object.fromEntries(Object.entries(t).filter(([, ts]) => Date.now() - ts < 60000))),
      10000,
    );
    return () => {
      clearInterval(poll);
      clearInterval(sweep);
      void sb.removeChannel(ch);
      chRef.current = null;
    };
  }, [active, session.codename, session.role, isAdmin, pull]);

  // GPS telemetry (members only), every 5s.
  useEffect(() => {
    if (!active || isAdmin || !("geolocation" in navigator)) return;
    let last: GeolocationPosition | null = null;
    const wid = navigator.geolocation.watchPosition(
      (p) => (last = p),
      (e) => setError(`GPS: ${e.message}`),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    const t = setInterval(async () => {
      if (!last) return;
      const c = last.coords;
      const body = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, heading: c.heading, speed: c.speed };
      void fetch("/api/locations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      void send("LOC", { codename: session.codename, role: session.role, ...body });
    }, 5000);
    return () => {
      navigator.geolocation.clearWatch(wid);
      clearInterval(t);
    };
  }, [active, isAdmin, send, session.codename, session.role]);

  // Admin: authoritative member positions from the DB.
  useEffect(() => {
    if (!active || !isAdmin) return;
    const load = async () => {
      const res = await fetch("/api/locations");
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (!Array.isArray(json)) return;
      const rows: MemberPos[] = json;
      setMembers((m) => ({ ...m, ...Object.fromEntries(rows.map((r) => [r.user_codename, r])) }));
    };
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [active, isAdmin]);

  async function postMessage(body: object) {
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "SEND FAILED");
    const row: Row = await res.json();
    await ingest([row], false);
    chRef.current?.send({ type: "broadcast", event: "MSG", payload: { id: row.id } });
  }

  async function sendText(t: "chat" | "alert") {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    try {
      await postMessage(await sealed({ t, text }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const startPTT = useCallback(async () => {
    if (recorder.current || !keyRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.current = { mr, chunks, stream };
      mr.start();
      setTransmitting(true);
      void radioCue();
      void send("TALK", { codename: session.codename, talking: true });
    } catch {
      setError("MICROPHONE ACCESS DENIED");
    }
  }, [send, session.codename]);

  const stopPTT = useCallback(async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    setTransmitting(false);
    void send("TALK", { codename: session.codename, talking: false });
    await new Promise<void>((done) => {
      r.mr.onstop = () => done();
      r.mr.stop();
    });
    r.stream.getTracks().forEach((t) => t.stop());
    void staticBurst();
    if (!r.chunks.length) return;
    try {
      const enc = await encryptBlob(keyRef.current!, await new Blob(r.chunks).arrayBuffer());
      const up = await fetch("/api/voice", { method: "POST", body: enc as BodyInit });
      if (!up.ok) throw new Error("UPLOAD FAILED");
      await postMessage({ audio_url: (await up.json()).path });
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, session.codename]);

  useEffect(() => {
    if (!active || tab !== "comms") return;
    const typing = () => ["INPUT", "TEXTAREA"].includes((document.activeElement?.tagName ?? ""));
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !typing()) {
        e.preventDefault();
        void startPTT();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing()) void stopPTT();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [active, tab, startPTT, stopPTT]);

  async function logout() {
    keyStore.clear();
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!active) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <div className="relative w-full max-w-sm border border-line bg-panel/90 p-6 text-center space-y-4">
          <span className="hud-corner tl" /><span className="hud-corner br" />
          <p className="text-xs text-dim">OPERATOR</p>
          <p className="text-xl text-accent">{session.codename}</p>
          <p className="text-xs text-warn tracking-widest">CLEARANCE: {session.role}</p>
          <button onClick={activate} className="w-full border border-accent text-accent py-3 tracking-[0.25em] hover:bg-accent hover:text-black">
            ACTIVATE TACTICAL COMMS
          </button>
          <button onClick={logout} className="text-xs text-dim underline">ABORT</button>
        </div>
      </main>
    );
  }

  const talking = Object.keys(talkers).filter((c) => c !== session.codename);
  const tabs: [Tab, string][] = [["comms", "COMMS"], ...(isAdmin ? ([["radar", "GOD EYES"]] as [Tab, string][]) : []), ["monitor", "WORLD MONITOR"]];

  return (
    <div className="h-screen flex flex-col">
      {alert && (
        <div className="alert-flash bg-danger/40 border-b border-danger text-center py-2 text-sm font-bold tracking-widest text-white">
          ⚠ COMMAND ALERT: {alert}
        </div>
      )}
      {talking.map((c) => (
        <div key={c} className="tx-banner bg-danger/20 border-b border-danger text-center py-1.5 text-sm text-danger tracking-widest">
          ● {c} IS TRANSMITTING…
        </div>
      ))}
      <header className="flex items-center justify-between border-b border-line bg-panel px-3 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-accent" dir="auto">رموز الحق</span>
          <nav className="flex gap-1">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1 border ${tab === k ? "border-accent text-accent" : "border-line text-dim"}`}>{l}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-dim hidden sm:inline">{online.length} ONLINE</span>
          <span className="text-warn">{session.codename} [{session.role}]</span>
          <button onClick={logout} className="border border-line px-2 py-1 text-dim hover:text-danger">EXIT</button>
        </div>
      </header>
      {error && (
        <button onClick={() => setError("")} className="bg-danger/20 text-danger text-xs py-1 text-left px-3">⚠ {error} (dismiss)</button>
      )}
      <main className="flex-1 min-h-0 relative">
        {tab === "comms" && (
          <div className="h-full flex flex-col md:flex-row">
            <section className="flex-1 min-h-0 flex flex-col">
              <Feed msgs={msgs} me={session.codename} />
              <div className="border-t border-line bg-panel p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000}
                    onKeyDown={(e) => e.key === "Enter" && sendText("chat")}
                    placeholder="ENCRYPTED MESSAGE…"
                    className="flex-1 bg-black/60 border border-line px-3 py-2 text-sm outline-none focus:border-accent" />
                  <button onClick={() => sendText("chat")} className="border border-accent text-accent px-4 text-sm">SEND</button>
                  {isAdmin && (
                    <button onClick={() => sendText("alert")} className="border border-danger text-danger px-3 text-sm">ALERT</button>
                  )}
                </div>
                <button
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void startPTT(); }}
                  onPointerUp={() => void stopPTT()}
                  onPointerCancel={() => void stopPTT()}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`w-full py-4 text-sm tracking-[0.3em] select-none touch-none border ${
                    transmitting ? "bg-danger text-white border-danger" : "border-accent text-accent"
                  }`}>
                  {transmitting ? "● TRANSMITTING — RELEASE TO SEND" : "HOLD TO TALK  [SPACE]"}
                </button>
              </div>
            </section>
            <aside className="md:w-56 border-t md:border-t-0 md:border-l border-line bg-panel p-3 text-xs space-y-1 overflow-auto max-h-40 md:max-h-none">
              <p className="text-dim mb-2">UNITS ONLINE</p>
              {online.map((o) => (
                <p key={o.codename} className="flex justify-between">
                  <span className={talkers[o.codename] ? "text-danger" : "text-accent"}>● {o.codename}</span>
                  <span className="text-dim">{o.role}</span>
                </p>
              ))}
            </aside>
          </div>
        )}
        {tab === "radar" && isAdmin && (
          <RadarMap members={Object.values(members)} online={online} quakes={quakes} />
        )}
        {tab === "monitor" && (
          <WorldMonitor quakes={quakes} status={quakeStatus} alerts={msgs.filter((m) => m.kind === "alert")} />
        )}
      </main>
      <Ticker quakes={quakes} alert={alert} />
    </div>
  );
}

function Feed({ msgs, me }: { msgs: Msg[]; me: string }) {
  const end = useRef<HTMLDivElement>(null);
  const list = Array.isArray(msgs) ? msgs : [];
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [list.length]);
  return (
    <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2 text-sm">
      {list.map((m) => (
        <div key={m.id} className={`max-w-[85%] border px-3 py-1.5 ${m.sender_codename === me ? "ml-auto border-accent/40" : "border-line"} ${m.kind === "alert" ? "border-danger text-danger" : ""}`}>
          <p className="text-[10px] text-dim">
            {m.sender_codename} · {m.role} · {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
          </p>
          {m.kind === "voice" && m.audio_url ? <VoiceClip path={m.audio_url} /> : <p dir="auto" className="break-words">{m.text}</p>}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

/** Manual replay for a voice clip: fetched ciphertext is decrypted in memory only. */
function VoiceClip({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  async function play() {
    setBusy(true);
    try {
      const key = await deriveKey(keyStore.get() ?? "");
      const res = await fetch(`/api/voice?path=${encodeURIComponent(path)}`);
      const url = URL.createObjectURL(new Blob([await decryptBlob(key, await res.arrayBuffer())], { type: "audio/webm" }));
      const a = new Audio(url);
      a.onended = () => URL.revokeObjectURL(url);
      await a.play();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={play} disabled={busy} className="text-accent text-xs">▶ VOICE TRANSMISSION {busy ? "…" : ""}</button>
  );
}

function Ticker({ quakes, alert }: { quakes: ReturnType<typeof useQuakes>["quakes"]; alert: string | null }) {
  const items = quakes.slice(0, 12).map((q) => `M${q.mag?.toFixed(1)} ${q.place}`);
  const text = alert ? `⚠ ${alert}` : items.length ? items.join("   //   ") : "WORLD MONITOR: AWAITING FEED";
  return (
    <footer className="border-t border-line bg-black overflow-hidden text-xs py-1 text-warn">
      <div className="ticker inline-block">{text}</div>
    </footer>
  );
}
