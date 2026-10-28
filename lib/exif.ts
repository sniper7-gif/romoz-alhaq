export interface ExifField {
  label: string;
  value: string;
  sensitive?: boolean;
}
export interface ExifReport {
  fields: ExifField[];
  gps: { lat: number; lng: number } | null;
}

type Tags = Record<number, string>;
type Bag = Map<string, unknown>;

const TAGS: Tags = {
  0x010f: "Make",
  0x0110: "Model",
  0x0131: "Software",
  0x0132: "DateTime",
  0x013b: "Artist",
  0x8298: "Copyright",
  0x0112: "Orientation",
  0x9003: "DateTimeOriginal",
  0xa434: "LensModel",
  0x829a: "ExposureTime",
  0x829d: "FNumber",
  0x8827: "ISO",
  0x920a: "FocalLength",
  0xa002: "PixelXDimension",
  0xa003: "PixelYDimension",
  0xa430: "CameraOwnerName",
  0xa431: "BodySerialNumber",
};
const GPS_TAGS: Tags = { 1: "GPSLatitudeRef", 2: "GPSLatitude", 3: "GPSLongitudeRef", 4: "GPSLongitude", 6: "GPSAltitude" };
const SENSITIVE = new Set(["Artist", "CameraOwnerName", "BodySerialNumber", "Copyright"]);
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface Ctx {
  v: DataView;
  tiff: number;
  le: boolean;
}

function value(c: Ctx, at: number, type: number, count: number): unknown {
  const { v, le } = c;
  if (type === 2) {
    let s = "";
    for (let k = 0; k < count - 1; k++) s += String.fromCharCode(v.getUint8(at + k));
    return s.trim();
  }
  if (type === 3) return count === 1 ? v.getUint16(at, le) : Array.from({ length: count }, (_, k) => v.getUint16(at + k * 2, le));
  if (type === 4) return v.getUint32(at, le);
  if (type === 5 || type === 10) {
    const r = Array.from({ length: count }, (_, k) => {
      const num = type === 5 ? v.getUint32(at + k * 8, le) : v.getInt32(at + k * 8, le);
      const den = type === 5 ? v.getUint32(at + k * 8 + 4, le) : v.getInt32(at + k * 8 + 4, le);
      return den ? num / den : 0;
    });
    return count === 1 ? r[0] : r;
  }
  return undefined;
}

function readIfd(c: Ctx, offset: number, tags: Tags, out: Bag, gps: Bag | null) {
  const { v, tiff, le } = c;
  if (offset < 0 || offset + 2 > v.byteLength) return;
  const n = v.getUint16(offset, le);
  for (let i = 0; i < n; i++) {
    const e = offset + 2 + i * 12;
    if (e + 12 > v.byteLength) break;
    const tag = v.getUint16(e, le);
    const type = v.getUint16(e + 2, le);
    const count = v.getUint32(e + 4, le);
    const size = (TYPE_SIZE[type] ?? 0) * count;
    if (!size) continue;

    if (gps && (tag === 0x8769 || tag === 0x8825)) {
      const sub = tiff + v.getUint32(e + 8, le);
      if (tag === 0x8769) readIfd(c, sub, TAGS, out, null);
      else readIfd(c, sub, GPS_TAGS, gps, null);
      continue;
    }
    if (!tags[tag]) continue;
    const at = size > 4 ? tiff + v.getUint32(e + 8, le) : e + 8;
    if (at + size > v.byteLength) continue;
    const val = value(c, at, type, count);
    if (val !== undefined) out.set(tags[tag], val);
  }
}

const dms = (v: unknown, ref: unknown) => {
  if (!Array.isArray(v) || v.length < 3) return null;
  const d = v[0] + v[1] / 60 + v[2] / 3600;
  return ref === "S" || ref === "W" ? -d : d;
};

const fmt = (name: string, v: unknown) => {
  if (name === "ExposureTime" && typeof v === "number") return v > 0 && v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`;
  if (name === "FNumber" && typeof v === "number") return `f/${v.toFixed(1)}`;
  if (name === "FocalLength" && typeof v === "number") return `${v.toFixed(1)} mm`;
  return Array.isArray(v) ? v.join(", ") : String(v);
};

/** Reads the EXIF block of a JPEG. Returns null when the file is not a JPEG. */
export function readExif(buf: ArrayBuffer): ExifReport | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  const report: ExifReport = { fields: [], gps: null };
  let p = 2;
  while (p + 4 < v.byteLength && v.getUint8(p) === 0xff) {
    const marker = v.getUint8(p + 1);
    const len = v.getUint16(p + 2);
    if (marker === 0xda) break;
    if (marker === 0xe1 && v.getUint32(p + 4) === 0x45786966) {
      const tiff = p + 10;
      const c: Ctx = { v, tiff, le: v.getUint16(tiff) === 0x4949 };
      const out: Bag = new Map();
      const gps: Bag = new Map();
      readIfd(c, tiff + v.getUint32(tiff + 4, c.le), TAGS, out, gps);
      for (const [k, val] of out) report.fields.push({ label: k, value: fmt(k, val), sensitive: SENSITIVE.has(k) });
      const lat = dms(gps.get("GPSLatitude"), gps.get("GPSLatitudeRef"));
      const lng = dms(gps.get("GPSLongitude"), gps.get("GPSLongitudeRef"));
      if (lat !== null && lng !== null) {
        report.gps = { lat, lng };
        report.fields.unshift({ label: "GPS", value: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, sensitive: true });
      }
      const alt = gps.get("GPSAltitude");
      if (typeof alt === "number") report.fields.push({ label: "GPSAltitude", value: `${alt.toFixed(1)} m`, sensitive: true });
      break;
    }
    p += 2 + len;
  }
  return report;
}
