"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { btnCls } from "@/components/ui/modal";
import { readExif, type ExifReport } from "@/lib/exif";

const MAX_BYTES = 25 * 1024 * 1024;
const OUT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ExifScrubber() {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ExifReport | null>(null);
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMsg(null);
    setReport(null);
    if (!f.type.startsWith("image/")) return setMsg({ ok: false, text: t("exifNotImage") });
    if (f.size > MAX_BYTES) return setMsg({ ok: false, text: "≤ 25 MB" });
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setReport(readExif(await f.arrayBuffer()));
  }

  async function scrub() {
    if (!file) return;
    setBusy(true);
    try {
      // Re-drawing the pixels onto a canvas drops every metadata block (EXIF, GPS, XMP, text chunks).
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext("2d")?.drawImage(bmp, 0, 0);
      bmp.close();
      const type = OUT_TYPES.includes(file.type) ? file.type : "image/png";
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type, 0.92));
      if (!blob) throw new Error("encode");
      const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `clean_${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setMsg({ ok: true, text: t("exifDone") });
    } catch {
      setMsg({ ok: false, text: t("exifFail") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-dim">{t("exifIntro")}</p>
      <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => input.current?.click()} className={btnCls}>
          {t("exifPick")}
        </button>
        <button type="button" onClick={scrub} disabled={!file || busy} className={`${btnCls} border-danger text-danger hover:bg-danger/10`}>
          {busy ? "…" : t("exifScrub")}
        </button>
      </div>

      {file && (
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-40 border border-line object-contain" />
          <div className="min-w-0 text-xs" dir="ltr">
            <p className="truncate text-accent">{file.name} · {(file.size / 1024).toFixed(0)} KB · {file.type}</p>
            {report === null ? (
              <p className="mt-2 text-dim">{t("exifUnsupported")}</p>
            ) : report.fields.length === 0 ? (
              <p className="mt-2 text-accent">{t("exifNone")}</p>
            ) : (
              <>
                {report.gps && (
                  <p role="alert" className="mt-2 border border-danger/60 bg-danger/10 px-2 py-1 text-danger">
                    ⚠ {t("exifGpsWarn")}
                  </p>
                )}
                <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
                  {report.fields.map((f) => (
                    <div key={f.label} className="contents">
                      <dt className={f.sensitive ? "text-danger" : "text-dim"}>{f.label}</dt>
                      <dd className={`break-words ${f.sensitive ? "text-danger" : ""}`}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className={`text-xs ${msg.ok ? "text-accent" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
