"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import Modal, { btnCls, inputCls } from "@/components/ui/modal";
import type { Session } from "@/lib/auth";
import { AVATARS, DEFAULT_PROXY, type ProxyConfig } from "@/lib/data";
import { useProfile } from "@/lib/profile";
import { usePersisted } from "@/lib/store";

const MAX_AVATAR_BYTES = 150_000;
const isImage = (a: string) => a.startsWith("data:image/");

function Avatar({ value, size = 56 }: { value: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center overflow-hidden border border-accent/50 bg-black text-2xl">
      {isImage(value) ? (
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
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                aria-pressed={avatar === a}
                className={`size-9 border text-lg ${avatar === a ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}
              >
                {a}
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

function ProxyPanel() {
  const { t } = useT();
  const [saved, setSaved] = usePersisted<ProxyConfig>("proxy", DEFAULT_PROXY);
  const [form, setForm] = useState(saved);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const port = Number(form.port);
  const valid = !form.enabled || (form.host.trim().length > 0 && Number.isInteger(port) && port >= 1 && port <= 65535);
  const set = <K extends keyof ProxyConfig>(k: K, v: ProxyConfig[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg(null);
  };

  function save() {
    if (!valid) return setMsg({ ok: false, text: t("proxyInvalid") });
    setSaved({ ...form, host: form.host.trim() });
    setMsg({ ok: true, text: t("proxySaved") });
  }

  function test() {
    if (!valid || !form.enabled) return setMsg({ ok: false, text: t("proxyInvalid") });
    setTesting(true);
    timer.current = setTimeout(() => {
      setTesting(false);
      setMsg({ ok: true, text: t("proxyOk") });
    }, 900);
  }

  return (
    <div className="space-y-3 border border-line bg-panel p-4">
      <h3 className="text-xs tracking-widest text-dim">{t("proxy")}</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-[#00ff41]" />
        {t("proxyEnable")}
      </label>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_7rem]" dir="ltr">
        <select aria-label={t("proxyType")} value={form.type} onChange={(e) => set("type", e.target.value as ProxyConfig["type"])} disabled={!form.enabled} className={inputCls}>
          <option value="socks5">SOCKS5</option>
          <option value="http">HTTP</option>
          <option value="https">HTTPS</option>
        </select>
        <input aria-label={t("proxyHost")} placeholder="127.0.0.1" value={form.host} onChange={(e) => set("host", e.target.value)} disabled={!form.enabled} className={inputCls} />
        <input aria-label={t("proxyPort")} placeholder="9050" inputMode="numeric" value={form.port} onChange={(e) => set("port", e.target.value.replace(/\D/g, "").slice(0, 5))} disabled={!form.enabled} className={inputCls} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} className={btnCls}>
          {t("save")}
        </button>
        <button type="button" onClick={test} disabled={testing || !form.enabled} className={btnCls}>
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
