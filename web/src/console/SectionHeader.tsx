import { useEffect, useState } from "react";
import type { Section } from "../Sidebar";
import { FLOWS } from "./flows";

/** The spine at the top of the section rail: what this section is for, in one sentence,
 *  and the numbered path through it. Clicking a step scrolls the rail to that card
 *  (cards carry the same number via <Step>). Sticky, so the path is always visible. */
export default function SectionHeader({ section, cityName }: { section: Section; cityName?: string }) {
  const flow = FLOWS[section];
  const [active, setActive] = useState(1);

  // Track which step is in view so the strip doubles as a progress indicator.
  useEffect(() => {
    setActive(1);
    const rail = document.querySelector<HTMLElement>("[data-rail]");
    if (!rail || typeof IntersectionObserver === "undefined") return;
    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-step]"));
    if (!cards.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(Number((visible[0].target as HTMLElement).dataset.step));
      },
      { root: rail, threshold: 0.35 },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [section]);

  const jump = (n: number) => {
    // A step without its own card (e.g. "Worst places now" = the map, or a step that
    // lives inside the previous card) scrolls to the nearest card at or below it.
    let el: HTMLElement | null = null;
    for (let k = n; k >= 1 && !el; k--) el = document.querySelector<HTMLElement>(`[data-rail] [data-step="${k}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else document.querySelector<HTMLElement>("[data-rail]")?.scrollTo({ top: 0, behavior: "smooth" });
    setActive(n);
  };

  return (
    <div className="vn-card sticky top-0 z-20 p-3" data-tour="spine">
      <div className="flex items-baseline gap-2">
        <span className="vn-kicker">{flow.verb}</span>
        <span className="text-[15px] font-extrabold tracking-tight text-slate-900">{flow.title}</span>
        {cityName && <span className="ml-auto truncate text-[11px] font-semibold text-slate-400">{cityName}</span>}
      </div>
      <p className="mt-0.5 text-[12px] leading-4 text-slate-600">{flow.blurb}</p>
      <ol className="mt-2 flex flex-wrap gap-1" aria-label="Path through this section">
        {flow.steps.map((s) => {
          const on = s.n === active;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => jump(s.n)}
                aria-current={on ? "step" : undefined}
                className={`flex cursor-pointer items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-semibold transition-colors ${
                  on ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold ${on ? "bg-white text-blue-700" : "bg-white text-slate-500"}`}>{s.n}</span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
