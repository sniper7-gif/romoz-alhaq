"use client";
import { useState } from "react";
import { useT } from "@/components/providers";
import { btnCls, inputCls } from "@/components/ui/modal";

interface IpWho {
  success: boolean;
  message?: string;
  ip: string;
  type: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  connection: { asn: number; org: string; isp: string; domain: string };
  timezone: { id: string; utc: string };
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+:[0-9a-f:]*$/i;

/** ipwho.is only takes IPs, so hostnames go through Cloudflare DNS-over-HTTPS first. */
async function resolve(host: string) {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`, { headers: { accept: "application/dns-json" } });
  const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
  return j.Answer?.find((a) => a.type === 1)?.data ?? null;
}

export default function IpRecon() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ data: IpWho; host: string } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      const target = q.trim().replace(/^https?:\/\//i, "").replace(/[/?#].*$/, "");
      let ip = target;
      let host = "";
      if (target && !IP_RE.test(target)) {
        host = target;
        const found = await resolve(target);
        if (!found) throw new Error(t("reconNoDns"));
        ip = found;
      }
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
      const data = (await r.json()) as IpWho;
      if (!data.success) throw new Error(data.message || t("netError"));
      setRes({ data, host });
    } catch (x) {
      setErr(x instanceof Error && x.message ? x.message : t("netError"));
    } finally {
      setBusy(false);
    }
  }

  const d = res?.data;
  const rows: [string, string][] = d
    ? [
        ["IP", `${d.ip} (${d.type})`],
        ...(res.host ? ([["Host", res.host]] as [string, string][]) : []),
        [t("reconLocation"), [d.city, d.region, d.country].filter(Boolean).join(", ")],
        [t("reconCoords"), `${d.latitude}, ${d.longitude}`],
        ["ASN", `AS${d.connection.asn}`],
        [t("reconOrg"), d.connection.org],
        ["ISP", d.connection.isp],
        [t("reconDomain"), d.connection.domain],
        [t("reconTz"), `${d.timezone.id} (UTC${d.timezone.utc})`],
      ]
    : [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-dim">{t("reconIntro")}</p>
      <form onSubmit={run} className="flex gap-2" dir="ltr">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("reconPlaceholder")} aria-label={t("reconPlaceholder")} maxLength={253} className={inputCls} />
        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? "…" : t("reconRun")}
        </button>
      </form>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      {d && (
        <>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 border border-line bg-black/40 p-3 text-xs" dir="ltr">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-dim">{k}</dt>
                <dd className="break-words text-accent">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <a
            href={`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=9/${d.latitude}/${d.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-dim underline hover:text-accent"
          >
            {t("reconMap")}
          </a>
        </>
      )}
    </div>
  );
}
