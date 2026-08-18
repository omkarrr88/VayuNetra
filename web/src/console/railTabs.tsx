import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Section } from "../Sidebar";
import { FLOWS } from "./flows";
import { RailContext, shownStep, useRail } from "./railContext";

/** The rail is a tabbed pane, not an endless scroll: the section spine is the tab bar and only the
 *  selected step's card is mounted. Cards that share a step number appear together. Steps whose
 *  content lives inside another card (or on the map) are still clickable — they select the nearest
 *  step that has a card, so the numbering in the docs and the deck keeps matching the UI. */
export function RailTabsProvider({ section, children }: { section: Section; children: ReactNode }) {
  const [active, setActive] = useState(1);
  const [present, setPresent] = useState<number[]>([]);
  useEffect(() => { setActive(1); setPresent([]); }, [section]);
  const register = (n: number) => setPresent((p) => (p.includes(n) ? p : [...p, n].sort((a, b) => a - b)));
  const value = useMemo(() => ({ active, setActive, register, steps: present }), [active, present]);
  return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

export function useRailTabs() { return useRail() ?? { active: 1, setActive: () => {}, register: () => {}, steps: [] as number[] }; }

/** A card with no step of its own rides along with the given step's tab. */
export function RailTab({ n, children }: { n: number; children: ReactNode }) {
  const { active, steps } = useRailTabs();
  return n === shownStep(active, steps) ? <div className="vn-fade-in">{children}</div> : null;
}

/** Tab strip for the section: verb, blurb and the numbered steps of FLOWS. */
export function RailTabBar({ section, cityName }: { section: Section; cityName?: string }) {
  const flow = FLOWS[section];
  const { active, setActive, steps } = useRailTabs();
  const select = (n: number) => {
    // always honour the click: a card that is still fetching registers later and then takes over
    setActive(n);
    document.querySelector<HTMLElement>("[data-rail]")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const shown = shownStep(active, steps);
  return (
    <div className="vn-card sticky top-0 z-20 p-3" data-tour="spine">
      <div className="flex items-baseline gap-2">
        <span className="vn-kicker">{flow.verb}</span>
        <span className="text-[15px] font-extrabold tracking-tight text-slate-900">{flow.title}</span>
        {cityName && <span className="ml-auto truncate text-[11px] font-semibold text-slate-500">{cityName}</span>}
      </div>
      <p className="mt-0.5 text-[12px] leading-4 text-slate-600">{flow.blurb}</p>
      <ol className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Path through this section">
        {flow.steps.map((s) => {
          const on = s.n === active || (s.n === shown && !steps.includes(active));
          const hasCard = steps.includes(s.n);
          return (
            <li key={s.n} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => select(s.n)}
                title={hasCard ? undefined : "This step lives inside the card above (or on the map)"}
                className={`flex min-h-6 cursor-pointer items-center gap-1 rounded-full py-1 pl-0.5 pr-2 text-[11px] font-semibold transition-colors ${
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
