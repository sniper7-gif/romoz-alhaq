"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useT } from "@/components/providers";
import Modal, { btnCls, inputCls } from "@/components/ui/modal";
import type { Session } from "@/lib/auth";
import type { Key } from "@/lib/i18n";
import { AVATARS, DEFAULT_PROXY, isImageAvatar, type ProxyConfig } from "@/lib/data";
import { useProfile } from "@/lib/profile";
import { useStealth, type InstallResult } from "@/components/stealth";
import { DISGUISES, PROFILES, svgIconUrl, type DisguiseId } from "@/lib/disguise";
import { usePersisted } from "@/lib/store";

const MAX_AVATAR_BYTES = 150_000;

function Avatar({ value, size = 56 }: { value: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center overflow-hidden border border-accent/50 bg-black text-2xl">
      {isImageAvatar(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="size-full object-cover" />
      ) : (
        value
      )}
    </span>
  );
}

function ProfileModal({ codename, onClose }: { codename: string; onClose: () => void }) {
  const { t } = useT();
  const [profile, setProfile] = useProfile(codename);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [bio, setBio] = useState(profile.bio);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > MAX_AVATAR_BYTES) return setErr("≤ 150 KB");
    const r = new FileReader();
    r.onload = () => {
      setAvatar(String(r.result));
      setErr("");
    };
    r.readAsDataURL(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setProfile({ avatar, bio: bio.trim() });
    onClose();
  }

  return (
    <Modal title={t("editProfile")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex items-center gap-4">
          <Avatar value={avatar} size={72} />
          <div className="flex flex-wrap gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a.v}
                type="button"
                title={a.label}
                aria-label={a.label}
                onClick={() => setAvatar(a.v)}
                aria-pressed={avatar === a.v}
                className={`grid size-10 place-items-center overflow-hidden border text-lg ${avatar === a.v ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}
              >
                {isImageAvatar(a.v) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.v} alt="" className="size-full object-cover" />
                ) : (
                  a.v
                )}
              </button>
            ))}
          </div>
        </div>
        <input ref={file} type="file" accept="image/*" onChange={pickFile} className="hidden" />
        <button type="button" onClick={() => file.current?.click()} className={btnCls}>
          {t("uploadAvatar")}
        </button>
        <label className="block text-xs text-dim">
          {t("bio")}
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={160} className={`${inputCls} mt-1 resize-none`} />
        </label>
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-dim hover:text-fg">
            {t("cancel")}
          </button>
          <button type="submit" className={btnCls}>
            {t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const PROXY_TYPES: { v: ProxyConfig["type"]; label: string }[] = [
  { v: "socks5", label: "SOCKS5" },
  { v: "socks4", label: "SOCKS4" },
  { v: "http", label: "HTTP" },
  { v: "https", label: "HTTPS" },
  { v: "shadowsocks", label: "Shadowsocks" },
  { v: "tor", label: "Tor" },
];
const DOH_URL = { "1.1.1.1": "https://cloudflare-dns.com/dns-query", "9.9.9.9": "https://dns.quad9.net:5053/dns-query" } as const;

function ProxyPanel() {
  const { t, lang } = useT();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [stored, setSaved] = usePersisted<ProxyConfig>("proxy", DEFAULT_PROXY);
  const [form, setForm] = useState<ProxyConfig>({ ...DEFAULT_PROXY, ...stored });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const port = Number(form.port);
  const valid = !form.enabled || (form.host.trim().length > 0 && Number.isInteger(port) && port >= 1 && port <= 65535);
  const set = <K extends keyof ProxyConfig>(k: K, v: ProxyConfig[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg(null);
  };

  function save() {
    if (!valid) return setMsg({ ok: false, text: t("proxyInvalid") });
    setSaved({ ...form, host: form.host.trim(), endpoint: form.endpoint.trim() });
    setMsg({ ok: true, text: t("proxySaved") });
  }

  /** Browsers cannot open raw proxy sockets, so this measures round-trip to the mainframe endpoint, or to the chosen DoH resolver. */
  async function test() {
    setTesting(true);
    setMsg(null);
    const t0 = performance.now();
    const ctl = new AbortController();
    const kill = setTimeout(() => ctl.abort(), 7000);
    try {
      const ep = form.endpoint.trim();
      if (ep) {
        await fetch(ep, { mode: "no-cors", cache: "no-store", signal: ctl.signal });
      } else {
        const base = form.doh === "custom" ? form.dohCustom.trim() : DOH_URL[form.doh];
        if (!base) throw new Error("no-target");
        const r = await fetch(`${base}?name=example.com&type=A`, { headers: { accept: "application/dns-json" }, cache: "no-store", signal: ctl.signal });
        if (!r.ok) throw new Error("bad");
      }
      setMsg({ ok: true, text: `${L("متصل", "Reachable")} · ${Math.round(performance.now() - t0)} ms` });
    } catch {
      setMsg({ ok: false, text: L("فشل الاتصال / انتهت المهلة", "Unreachable / timed out") });
    } finally {
      clearTimeout(kill);
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3 border border-line bg-panel p-4">
      <h3 className="text-xs tracking-widest text-dim">{t("proxy")}</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-[#00ff41]" />
        {t("proxyEnable")}
      </label>
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr_7rem]" dir="ltr">
        <select aria-label={t("proxyType")} value={form.type} onChange={(e) => set("type", e.target.value as ProxyConfig["type"])} className={inputCls}>
          {PROXY_TYPES.map((p) => (
            <option key={p.v} value={p.v}>{p.label}</option>
          ))}
        </select>
        <input aria-label={t("proxyHost")} placeholder="Host / IP  127.0.0.1" value={form.host} onChange={(e) => set("host", e.target.value)} className={inputCls} />
        <input aria-label={t("proxyPort")} placeholder="9050" inputMode="numeric" value={form.port} onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))} className={inputCls} />
      </div>
      <input aria-label="Mainframe Endpoint URL" dir="ltr" placeholder="Mainframe Endpoint URL  https://…" value={form.endpoint} onChange={(e) => set("endpoint", e.target.value)} className={inputCls} />
      <div className="grid gap-3 sm:grid-cols-2" dir="ltr">
        <input aria-label="Username" autoComplete="off" placeholder="Username" value={form.username} onChange={(e) => set("username", e.target.value)} className={inputCls} />
        <input aria-label="Password" type="password" autoComplete="new-password" placeholder="Password" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputCls} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2" dir="ltr">
        <label className="block text-[11px] text-dim">
          DNS-over-HTTPS
          <select value={form.doh} onChange={(e) => set("doh", e.target.value as ProxyConfig["doh"])} className={`${inputCls} mt-1`}>
            <option value="1.1.1.1">1.1.1.1 (Cloudflare)</option>
            <option value="9.9.9.9">9.9.9.9 (Quad9)</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {form.doh === "custom" && (
          <label className="block text-[11px] text-dim">
            DoH URL
            <input placeholder="https://dns.example/dns-query" value={form.dohCustom} onChange={(e) => set("dohCustom", e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.killSwitch} onChange={(e) => set("killSwitch", e.target.checked)} className="size-4 accent-[#00ff41]" />
          Kill-Switch
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.autoRotate} onChange={(e) => set("autoRotate", e.target.checked)} className="size-4 accent-[#00ff41]" />
          Auto-Rotate IP
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} className={btnCls}>
          {t("save")}
        </button>
        <button type="button" onClick={test} disabled={testing} className={btnCls}>
          {testing ? t("proxyTesting") : t("proxyTest")}
        </button>
        {msg && (
          <span role="status" className={`text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

const DISGUISE_LABEL = {
  default: "disguiseDefault",
  hood: "disguiseHood",
  calculator: "disguiseCalculator",
  radio: "disguiseRadio",
  weather: "disguiseWeather",
  notes: "disguiseNotes",
} as const satisfies Record<DisguiseId, Key>;

const INSTALL_MSG = {
  accepted: "installAccepted",
  dismissed: "installDismissed",
  ios: "installIos",
  installed: "installDone",
  manual: "installManual",
} as const satisfies Record<InstallResult, Key>;

function StealthPanel() {
  const { t } = useT();
  const { disguise, setDisguise, setDecoy, install } = useStealth();
  const [msg, setMsg] = useState<Key | null>(null);

  return (
    <div className="space-y-3 border border-line bg-panel p-4">
      <h3 className="text-xs tracking-widest text-dim">{t("disguiseTitle")}</h3>
      <p className="text-xs text-dim">{t("disguiseHint")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t("disguiseTitle")}>
        {DISGUISES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setDisguise(id);
              setMsg(null);
            }}
            aria-pressed={disguise === id}
            className={`flex flex-col items-center gap-2 border p-3 text-xs ${disguise === id ? "border-accent bg-accent/10 text-accent" : "border-line text-dim hover:border-accent/50"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgIconUrl(id)} alt="" width={48} height={48} className="size-12 rounded-lg" style={{ background: PROFILES[id].theme }} />
            {t(DISGUISE_LABEL[id])}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={async () => setMsg(INSTALL_MSG[await install()])} className={btnCls}>
          {t("installBtn")}
        </button>
        <button type="button" onClick={() => setDecoy(true)} className={btnCls}>
          {t("decoyNow")}
        </button>
      </div>
      {msg && <p role="status" className="text-xs text-accent">{t(msg)}</p>}
      <p className="text-[11px] text-dim">{t("decoyHint")}</p>
    </div>
  );
}

export default function SettingsModule({ session, codename }: { session: Session; codename: string }) {
  const { t, lang, setLang } = useT();
  const router = useRouter();
  const [profile] = useProfile(codename);
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="glow text-sm tracking-widest">{t("tabSettings")} · {t("settingsTitle")}</h2>

      <div className="flex items-center gap-4 border border-line bg-panel p-4">
        <Avatar value={profile.avatar} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-accent" dir="ltr">
            {codename} <span className="text-dim">[{t(session.role === "OFFICER" ? "officer" : "soldier")}]</span>
          </p>
          {profile.bio && <p className="truncate text-xs text-dim">{profile.bio}</p>}
        </div>
        <button type="button" onClick={() => setEditing(true)} className={btnCls}>
          {t("editProfile")}
        </button>
      </div>

      <ProxyPanel />

      <StealthPanel />

      <div className="flex items-center justify-between border border-line bg-panel p-4">
        <span className="text-sm">{t("language")}</span>
        <div className="flex" role="group" aria-label={t("language")}>
          {(["ar", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`border px-4 py-1.5 text-xs ${lang === l ? "border-accent bg-accent/15 text-accent" : "border-line text-dim hover:text-fg"}`}
            >
              {l === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={logout} disabled={leaving} className={`${btnCls} w-full border-danger py-3 text-danger hover:bg-danger/10`}>
        {leaving ? t("logoutBusy") : t("logout")}
      </button>

      {editing && <ProfileModal codename={codename} onClose={() => setEditing(false)} />}
    </section>
  );
}
