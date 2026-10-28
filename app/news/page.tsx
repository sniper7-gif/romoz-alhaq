import type { Metadata } from "next";

export const metadata: Metadata = { title: "Daily Brief — News & Weather" };

const WEATHER = [
  { city: "Riyadh", temp: 34, sky: "☀️", note: "Clear" },
  { city: "Cairo", temp: 31, sky: "⛅", note: "Partly cloudy" },
  { city: "Amman", temp: 24, sky: "🌤️", note: "Mostly sunny" },
  { city: "Casablanca", temp: 22, sky: "🌥️", note: "Cloudy" },
  { city: "Dubai", temp: 36, sky: "☀️", note: "Hot and humid" },
  { city: "Tunis", temp: 27, sky: "🌦️", note: "Light showers" },
];

const HEADLINES = [
  { tag: "Economy", title: "Regional markets close mixed as energy prices steady" },
  { tag: "Sport", title: "Weekend fixtures: league leaders face tough away trips" },
  { tag: "Technology", title: "New budget smartphones arrive with longer battery life" },
  { tag: "Health", title: "Doctors recommend more water and shade during the heatwave" },
  { tag: "Travel", title: "Airports expect a busy holiday week; arrive early" },
  { tag: "Culture", title: "Annual book fair opens its doors to the public" },
];

/** Harmless landing page shown after the duress code. It must not mention the app. */
export default function DecoyNews() {
  return (
    <div dir="ltr" lang="en" className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold tracking-tight">Daily Brief</h1>
          <span className="text-xs text-slate-500">News &amp; Weather</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-[2fr_1fr]">
        <section aria-label="Top stories">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Top stories</h2>
          <ul className="space-y-3">
            {HEADLINES.map((h) => (
              <li key={h.title} className="rounded border border-slate-200 bg-white p-4">
                <span className="text-[11px] font-semibold uppercase text-sky-700">{h.tag}</span>
                <p className="mt-1 font-medium">{h.title}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside aria-label="Weather">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Weather</h2>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {WEATHER.map((w) => (
              <li key={w.city} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="text-2xl">{w.sky}</span>
                <span className="flex-1">
                  <span className="block font-medium">{w.city}</span>
                  <span className="text-xs text-slate-500">{w.note}</span>
                </span>
                <span className="text-lg tabular-nums">{w.temp}°</span>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
