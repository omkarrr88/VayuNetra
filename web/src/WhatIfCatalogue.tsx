// Intervention catalogue cards for the what-if simulator.
import { SOURCE_COLORS, type Shares } from "./sources";

const INTERVENTIONS = [
  { id: "waste_burn_ban", label: "Crop-residue / waste burn ban", sources: ["biomass_burning"] },
  { id: "construction_halt", label: "Halt construction dust", sources: ["construction_dust"] },
  { id: "traffic_restriction", label: "Traffic restriction (odd-even)", sources: ["traffic"] },
  { id: "industrial_shutdown", label: "Industrial shutdown", sources: ["industrial"] },
  { id: "grap_stage3", label: "GRAP Stage III (combined)", sources: ["traffic", "construction_dust", "industrial"] },
];

// Determine "room to act" reading
function roomToActReading(interventionId: string, avgShares: Shares): { text: string; minor: boolean } {
  const intervention = INTERVENTIONS.find((i) => i.id === interventionId);
  if (!intervention) return { text: "", minor: false };

  // Find the max share among this intervention's sources
  let maxShare = 0;
  for (const source of intervention.sources) {
    maxShare = Math.max(maxShare, avgShares[source] ?? 0);
  }

  // Find the dominant source overall
  let dominantSource = "other";
  let dominantShare = 0;
  for (const [source, share] of Object.entries(avgShares)) {
    if (share > dominantShare) {
      dominantShare = share;
      dominantSource = source;
    }
  }

  if (maxShare < 0.01) {
    return { text: "little effect today", minor: true };
  } else if (intervention.sources.includes(dominantSource)) {
    return { text: "matches the dominant source", minor: false };
  } else {
    return { text: "", minor: false };
  }
}

// Convert RGB to CSS color
function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

interface InterventionCardProps {
  intervention: (typeof INTERVENTIONS)[0];
  isSelected: boolean;
  avgShares: Shares;
  onSelect: () => void;
}

export function InterventionCard({ intervention, isSelected, avgShares, onSelect }: InterventionCardProps) {
  const reading = roomToActReading(intervention.id, avgShares);

  // Calculate total share for this intervention
  let totalShare = 0;
  for (const source of intervention.sources) {
    totalShare += avgShares[source] ?? 0;
  }
  const sharePercent = Math.round(totalShare * 100);

  return (
    <button
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
        isSelected
          ? "border-blue-600 bg-blue-50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
      style={{
        minHeight: "44px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
      }}
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">{intervention.label}</div>
        <div className="text-xs text-slate-500 mt-1">
          {intervention.sources.map((s) => s.replace(/_/g, " ")).join(", ")}
        </div>
      </div>

      {/* Share bar */}
      <div>
        <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minHeight: "24px" }}>
            <div
              style={{
                height: "8px",
                background: "var(--surface-3)",
                borderRadius: "var(--r-sm)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(2, sharePercent)}%`,
                  background: `linear-gradient(90deg, ${intervention.sources
                    .map((src) => rgbToCss(SOURCE_COLORS[src] ?? SOURCE_COLORS.other))
                    .join(", ")})`,
                  transition: "width 200ms cubic-bezier(0.22, 0.72, 0.24, 1)",
                }}
              />
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-700 shrink-0">{sharePercent}%</span>
        </div>
      </div>

      {/* Room to act reading */}
      {reading.text && (
        <div
          className={`text-xs leading-4 ${reading.minor ? "text-slate-500 italic" : "font-medium text-emerald-700"}`}
        >
          {reading.text}
        </div>
      )}
    </button>
  );
}

export function InterventionChip({ intervention, isSelected, onSelect }: Omit<InterventionCardProps, "avgShares">) {
  return (
    <button
      onClick={onSelect}
      className={`text-xs px-2.5 py-1.5 rounded-full transition-colors ${
        isSelected
          ? "bg-blue-600 text-white font-medium"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {intervention.label.split(" ").slice(0, 2).join(" ")}
    </button>
  );
}

export { INTERVENTIONS };
