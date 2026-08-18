import { SECTIONS, type Section } from "./Sidebar";
import { linkClick } from "./router";
import { AqiScaleToggle } from "./aqiScale";
import { ThemeToggle } from "./theme";

type City = { city_id: string; name: string };

interface TopBarProps {
  cities: City[];
  active: string;
  onCity: (id: string) => void;
  section: Section;
  onReplayTour: () => void;
  present: boolean;
  onTogglePresent: () => void;
}

/** Slim navy header: brand, city switcher, current section, help. */
export default function TopBar({ cities, active, onCity, section, onReplayTour, present, onTogglePresent }: TopBarProps) {
  const current = SECTIONS.find((s) => s.id === section);
  return (
    <header className="z-20 flex h-12 shrink-0 items-center gap-3 bg-[var(--vn-nav)] pl-3 pr-2 shadow-md shadow-slate-900/20 sm:gap-4 sm:pl-4 sm:pr-3">
      <a href="/" onClick={(e) => linkClick(e, "/")} className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold tracking-tight text-white" title="Back to landing page">
        <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-lg" width={28} height={28} />
        <span className="hidden sm:inline">VayuNetra</span>
      </a>

      <select
        data-tour="city"
        className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-[13px] font-semibold text-white outline-none transition-colors [color-scheme:dark] hover:bg-white/15 focus:ring-2 focus:ring-emerald-400/60"
        value={active}
        onChange={(e) => onCity(e.target.value)}
        aria-label="Choose city"
      >
        {cities.length === 0 && <option value="delhi">Delhi</option>}
        {cities.map((c) => (
          <option key={c.city_id} value={c.city_id} className="text-slate-900">
            {c.name}
          </option>
        ))}
      </select>

      {current && (
        <div className="hidden min-w-0 items-baseline gap-2 md:flex" title={current.hint}>
          <span className="text-[12px] font-semibold text-slate-300">{current.label}</span>
          <span className="hidden truncate text-[11px] text-slate-400 xl:inline">· {current.hint}</span>
        </div>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div className="hidden md:block"><AqiScaleToggle /></div>
        <ThemeToggle />
        <button
          onClick={onTogglePresent}
          title={present ? "Exit presentation mode (P)" : "Presentation mode — larger type for a projector (P)"}
          aria-label="Toggle presentation mode"
          aria-pressed={present}
          className={`hidden h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors lg:flex ${
            present ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30" : "text-slate-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8m-4-4v4" />
          </svg>
          {present ? "Presenting" : "Present"}
        </button>
        <button
          onClick={onReplayTour}
          title="Replay the quick tour"
          aria-label="Replay the quick tour"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01" />
          </svg>
        </button>
        <a
          href="https://github.com/omkarrr88/VayuNetra"
          target="_blank"
          rel="noreferrer"
          title="Source on GitHub"
          aria-label="Source on GitHub"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.9 18.3 5.2 18.3 5.2c.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
          </svg>
        </a>
        <a
          href="/" onClick={(e) => linkClick(e, "/")}
          title="Back to landing page"
          aria-label="Back to landing page"
          className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:flex"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" />
          </svg>
          Landing
        </a>
      </div>
    </header>
  );
}
