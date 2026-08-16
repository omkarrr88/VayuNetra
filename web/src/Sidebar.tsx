export type Section =
  | "action"
  | "forecast"
  | "citizen"
  | "compare"
  | "whatif"
  | "impact"
  | "pipeline";

type SectionDef = {
  id: Section;
  label: string;
  hint: string;
  icon: string; // 24x24 stroke path(s)
};

// One honest sentence per section — this doubles as the tooltip and the
// first thing a new user reads, so plain language over product jargon.
export const SECTIONS: SectionDef[] = [
  {
    id: "action",
    label: "Enforcement",
    hint: "Ranked, evidence-backed actions for officers",
    icon: "M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Zm-3-10 2 2 4-4",
  },
  {
    id: "forecast",
    label: "Forecast",
    hint: "72-hour PM2.5 outlook with uncertainty",
    icon: "M3 17l5-6 4 3 5-7 4 5M3 21h18",
  },
  {
    id: "citizen",
    label: "Advisories",
    hint: "Citizen alerts in 4 languages + clean-air zones",
    icon: "M11 5 6 9H3v6h3l5 4V5Zm5.5 2.5a5 5 0 0 1 0 9M19 4a9 9 0 0 1 0 16",
  },
  {
    id: "compare",
    label: "Cities",
    hint: "10 Indian cities side by side",
    icon: "M3 21h18M6 21V10m6 11V4m6 17v-8",
  },
  {
    id: "whatif",
    label: "Simulator",
    hint: "What if we banned waste burning? Run it",
    icon: "M10 2v6L4 19a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3L14 8V2m-6 0h8",
  },
  {
    id: "impact",
    label: "Impact",
    hint: "Health burden, ₹ saved, fairness audit",
    icon: "M12 21C7 17 3 13.4 3 9.5A4.5 4.5 0 0 1 7.5 5c1.8 0 3.4 1 4.5 2.5A5.4 5.4 0 0 1 16.5 5 4.5 4.5 0 0 1 21 9.5c0 3.9-4 7.5-9 11.5Z",
  },
  {
    id: "pipeline",
    label: "Pipeline",
    hint: "Watch the 6 AI agents run live",
    icon: "M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 5h10M6 7l5 10m8-10-5 10",
  },
];

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

interface SidebarProps {
  active: Section;
  onSelect: (s: Section) => void;
}

/** Desktop navigation rail — navy brand, icon + label per section. */
export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav
      className="hidden w-48 shrink-0 flex-col bg-[#1b294a] lg:flex"
      aria-label="Console sections"
      data-tour="sidebar"
    >
      <div className="flex-1 space-y-0.5 px-2.5 pt-3">
        {SECTIONS.map((s) => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              title={s.hint}
              className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 ${
                on ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span
                className={`h-4 w-0.5 rounded-full transition-colors ${on ? "bg-emerald-400" : "bg-transparent"}`}
              />
              <Icon d={s.icon} className="h-[18px] w-[18px] shrink-0" />
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-slate-400">
        10 cities · Delhi to Lucknow
        <br />
        ₹0 infrastructure · open source
      </div>
    </nav>
  );
}

/** Mobile bottom navigation — same sections, thumb-reachable. */
export function BottomNav({ active, onSelect }: SidebarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex justify-between overflow-x-auto border-t border-slate-800 bg-[#1b294a] px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Console sections"
    >
      {SECTIONS.map((s) => {
        const on = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex min-w-[2.75rem] flex-1 flex-col items-center gap-0.5 px-0.5 py-1.5 text-[8px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 min-[400px]:min-w-[3.4rem] min-[400px]:px-1 min-[400px]:text-[9px] ${
              on ? "text-emerald-300" : "text-slate-400"
            }`}
          >
            <Icon d={s.icon} className="h-5 w-5" />
            <span className="w-full truncate text-center">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
