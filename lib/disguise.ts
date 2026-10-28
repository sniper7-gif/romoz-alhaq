export const DISGUISES = ["default", "hood", "calculator", "radio", "weather", "notes"] as const;
export type DisguiseId = (typeof DISGUISES)[number];
export type Lang = "ar" | "en";

interface Profile {
  name: Record<Lang, string>;
  theme: string;
  /** Raster icon override; disguises without one are drawn by /api/icon. */
  png?: string;
}

export const PROFILES: Record<DisguiseId, Profile> = {
  default: { name: { ar: "رموز الحق / L.I.S", en: "Symbols of Truth / L.I.S" }, theme: "#000000", png: "/logo-eagle.png" },
  hood: { name: { ar: "رموز الحق - الملثم", en: "Symbols of Truth - Masked Hacker" }, theme: "#000000", png: "/logo-hood.png" },
  calculator: { name: { ar: "الحاسبة", en: "Calculator" }, theme: "#1f2937" },
  radio: { name: { ar: "راديو FM", en: "FM Radio" }, theme: "#7c2d12" },
  weather: { name: { ar: "الطقس", en: "Weather" }, theme: "#0ea5e9" },
  notes: { name: { ar: "الملاحظات", en: "Notes" }, theme: "#facc15" },
};

export const isDisguise = (v: unknown): v is DisguiseId => DISGUISES.includes(v as DisguiseId);
export const isLang = (v: unknown): v is Lang => v === "ar" || v === "en";

export const manifestUrl = (id: DisguiseId, lang: Lang) => `/api/manifest?disguise=${id}&lang=${lang}`;
export const DISGUISE_COOKIE = "disguise_mode";
/** Always a real PNG: raster logos are resized server-side, drawn disguises are rendered from SVG. */
export const iconUrl = (id: DisguiseId, size: number) => `/api/icon?disguise=${id}&size=${size}`;
export const svgIconUrl = (id: DisguiseId) => PROFILES[id].png ?? `/api/icon?disguise=${id}&format=svg`;

const frame = (bg: string, art: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${bg}"/>${art}</svg>`;

/** Art stays inside the central ~70% so maskable crops never clip it. */
export const ICON_SVG: Record<Exclude<DisguiseId, "default" | "hood">, string> = {
  calculator: frame(
    "#1f2937",
    `<rect x="136" y="96" width="240" height="320" rx="28" fill="#374151"/>
     <rect x="156" y="116" width="200" height="72" rx="12" fill="#9ae6b4"/>
     ${[0, 1, 2, 3]
       .flatMap((r) => [0, 1, 2, 3].map((c) => `<rect x="${156 + c * 52}" y="${208 + r * 50}" width="44" height="40" rx="9" fill="${c === 3 ? "#f59e0b" : "#d1d5db"}"/>`))
       .join("")}`,
  ),
  radio: frame(
    "#7c2d12",
    `<path d="M170 150 L330 86" stroke="#fde68a" stroke-width="10" stroke-linecap="round"/>
     <rect x="96" y="150" width="320" height="230" rx="30" fill="#fbbf24"/>
     <circle cx="196" cy="265" r="62" fill="#78350f"/><circle cx="196" cy="265" r="40" fill="#92400e"/>
     <rect x="290" y="186" width="96" height="46" rx="8" fill="#fffbeb"/>
     <rect x="304" y="204" width="68" height="6" fill="#b45309"/><rect x="342" y="196" width="4" height="26" fill="#dc2626"/>
     <circle cx="322" cy="304" r="22" fill="#78350f"/><circle cx="372" cy="304" r="22" fill="#78350f"/>`,
  ),
  weather: frame(
    "#0ea5e9",
    `<circle cx="318" cy="196" r="70" fill="#fde047"/>
     <g stroke="#fde047" stroke-width="12" stroke-linecap="round"><path d="M318 80v-18M318 312v18M202 196h-18M434 196h18M236 114l-12-12M400 278l12 12M400 114l12-12"/></g>
     <path d="M170 380a58 58 0 0 1 8-115 80 80 0 0 1 152-14 66 66 0 0 1 12 129z" fill="#fff"/>`,
  ),
  notes: frame(
    "#facc15",
    `<rect x="136" y="90" width="240" height="332" rx="22" fill="#fffbeb"/>
     <rect x="136" y="90" width="240" height="64" rx="22" fill="#f59e0b"/><rect x="136" y="130" width="240" height="24" fill="#f59e0b"/>
     <g stroke="#a8a29e" stroke-width="8" stroke-linecap="round"><path d="M172 206h168M172 252h168M172 298h168M172 344h110"/></g>`,
  ),
};
