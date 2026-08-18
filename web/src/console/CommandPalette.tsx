// ⌘K / Ctrl-K — jump to any city or section without hunting for a control. On stage this is the
// difference between "let me find Mumbai in the dropdown" and typing three letters. Nothing here
// mutates anything: it only navigates, so it is safe to open in front of an audience.
import { useEffect, useMemo, useRef, useState } from "react";
import { SECTIONS, type Section } from "../Sidebar";
import { SCALES, type AqiScale } from "../aqi";
import { useAqiScale } from "../aqiScale";

export type PaletteCity = { city_id: string; name: string };

type Item = {
  id: string;
  kind: "city" | "section" | "scale";
  label: string;
  hint: string;
  keys?: string;
  run: () => void;
};

/** Simple subsequence match — "blr" finds "Bengaluru", "enf" finds "Enforcement". */
function score(item: Item, q: string): number {
  if (!q) return 0;
  const hay = `${item.label} ${item.hint}`.toLowerCase();
  const needle = q.toLowerCase();
  if (hay.startsWith(needle)) return 100;
  const at = hay.indexOf(needle);
  if (at >= 0) return 80 - Math.min(at, 40);
  let i = 0;
  for (const ch of needle) {
    i = hay.indexOf(ch, i);
    if (i < 0) return -1;
    i += 1;
  }
  return 20;
}

export function CommandPalette({
  cities, activeCity, activeSection, onCity, onSection,
}: {
  cities: PaletteCity[];
  activeCity: string;
  activeSection: Section;
  onCity: (c: string) => void;
  onSection: (s: Section) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { scale, setScale } = useAqiScale();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setSel(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const c of cities) {
      list.push({
        id: `city:${c.city_id}`, kind: "city", label: c.name, hint: "switch city",
        run: () => onCity(c.city_id),
      });
    }
    SECTIONS.forEach((s, i) => {
      list.push({
        id: `sec:${s.id}`, kind: "section", label: s.label, hint: s.hint, keys: String(i + 1),
        run: () => onSection(s.id),
      });
    });
    (Object.keys(SCALES) as AqiScale[]).forEach((k) => {
      list.push({ id: `scale:${k}`, kind: "scale", label: SCALES[k].short, hint: SCALES[k].name, run: () => setScale(k) });
    });
    return list;
  }, [cities, onCity, onSection, setScale]);

  const results = useMemo(() => {
    const scored = items.map((it) => ({ it, s: score(it, q) })).filter((x) => x.s >= 0);
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 9).map((x) => x.it);
  }, [items, q]);

  if (!open) return null;
  const choose = (it?: Item) => { if (!it) return; it.run(); setOpen(false); };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="vn-card w-full max-w-lg overflow-hidden p-0 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Jump to">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); choose(results[sel]); }
          }}
          placeholder="Jump to a city, a section, or a scale…"
          aria-label="Jump to a city, a section, or a scale"
          className="w-full border-b border-slate-200 bg-transparent px-4 py-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
        />
        <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
          {results.length === 0 && <li className="px-4 py-3 text-[13px] text-slate-500">Nothing matches “{q}”.</li>}
          {results.map((it, i) => {
            const on = i === sel;
            const current =
              (it.kind === "city" && it.id === `city:${activeCity}`) ||
              (it.kind === "section" && it.id === `sec:${activeSection}`) ||
              (it.kind === "scale" && it.id === `scale:${scale}`);
            return (
              <li key={it.id} role="option" aria-selected={on}>
                <button
                  onMouseEnter={() => setSel(i)}
                  onClick={() => choose(it)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${on ? "bg-blue-50" : ""}`}
                >
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    it.kind === "city" ? "bg-sky-100 text-sky-800" : it.kind === "section" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"
                  }`}>{it.kind}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] font-semibold text-slate-900">{it.label}</span>
                    <span className="ml-2 text-[11px] text-slate-500">{it.hint}</span>
                  </span>
                  {current && <span className="text-[10px] font-bold uppercase text-emerald-600">current</span>}
                  {it.keys && <kbd className="rounded border border-slate-300 px-1 font-mono text-[10px] text-slate-500">{it.keys}</kbd>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">
          ↑↓ move · ↵ open · esc close · this only navigates, it never changes data
        </div>
      </div>
    </div>
  );
}
