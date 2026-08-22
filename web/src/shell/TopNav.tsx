// One navigation bar for the whole product. The public app and the operations console pass their
// own set of links and their own trailing action; everything else — brand, city, scale, theme,
// position, height, glass — is identical, so moving between them never moves the furniture.
import { useEffect, useState, type ReactNode } from "react";
import { AqiScaleToggle } from "../aqiScale";
import { ThemeToggle } from "../theme";
import { linkClick } from "../router";
import { Text } from "../design/ui";
import { IconX } from "../design/icons";

export type NavItem = { id: string; label: string; hint?: string; key?: string };
export type City = { city_id: string; name: string };

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <a
      href="/"
      onClick={(e) => linkClick(e, "/")}
      style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-2)", textDecoration: "none", flex: "none" }}
      title="VayuNetra — back to the front page"
    >
      <img src="/icon-192.png" alt="" width={26} height={26} style={{ borderRadius: "var(--r-sm)", flex: "none" }} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <Text size="md" weight={800} tone="ink" tight style={{ letterSpacing: "-0.02em" }}>VayuNetra</Text>
        <Text size="2xs" tone="muted" weight={700} style={{ letterSpacing: "0.06em" }}>{subtitle}</Text>
      </span>
    </a>
  );
}

function CityPicker({ city, cities, onCity }: { city: string; cities: City[]; onCity: (id: string) => void }) {
  return (
    <label data-tour="city" style={{ display: "inline-flex", alignItems: "center" }}>
      <span className="sr-only">City</span>
      <select
        value={city}
        onChange={(e) => onCity(e.target.value)}
        aria-label="Choose a city"
        style={{
          appearance: "none", padding: "6px 26px 6px 10px", borderRadius: "var(--r-sm)",
          border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)",
          fontSize: "var(--t-sm)", fontWeight: 700, cursor: "pointer", minHeight: 32,
          backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
          backgroundPosition: "right 12px center, right 7px center",
          backgroundSize: "5px 5px, 5px 5px", backgroundRepeat: "no-repeat",
        }}
      >
        {cities.length === 0 && <option value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>}
        {cities.map((c) => <option key={c.city_id} value={c.city_id}>{c.name}</option>)}
      </select>
    </label>
  );
}

function Tab({ item, on, onSelect }: { item: NavItem; on: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      title={item.hint}
      aria-current={on ? "page" : undefined}
      style={{
        position: "relative", padding: "8px 2px", background: "none", border: 0, cursor: "pointer",
        whiteSpace: "nowrap", fontSize: "var(--t-sm)", fontWeight: 700,
        color: on ? "var(--ink)" : "var(--muted)", transition: "color var(--fast) var(--ease)",
      }}
    >
      {item.label}
      <span aria-hidden="true" style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2,
        background: "var(--primary)", transformOrigin: "left",
        transform: `scaleX(${on ? 1 : 0})`, transition: "transform var(--base) var(--ease)",
      }} />
    </button>
  );
}

export function TopNav({
  subtitle, navLabel, items, activeId, onSelect, city, cities, onCity, action, extras,
}: {
  subtitle: string;
  /** Accessible name for the link row — the two surfaces name their own sections. */
  navLabel: string;
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  city: string;
  cities: City[];
  onCity: (id: string) => void;
  /** The one button that crosses between the public app and the console. */
  action: { label: string; title?: string; onClick: () => void };
  /** Mode-specific controls (presentation mode, replay tour…) shown before the theme switch. */
  extras?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [activeId]);
  const pick = (id: string) => { onSelect(id); setOpen(false); };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50, flex: "none",
      background: "var(--glass)", backdropFilter: "saturate(1.5) blur(16px)",
      borderBottom: "1px solid var(--line)",
    }}>
      <div style={{ margin: "0 auto", maxWidth: 1360, padding: "0 var(--s-5)", display: "flex", alignItems: "center", gap: "var(--s-4)", height: 60 }}>
        <Brand subtitle={subtitle} />

        <nav data-tour="nav" aria-label={navLabel} className="vn-nav-wide" style={{ display: "flex", alignItems: "center", gap: "var(--s-4)", marginLeft: "var(--s-3)", minWidth: 0, overflow: "hidden" }}>
          {items.map((it) => <Tab key={it.id} item={it} on={it.id === activeId} onSelect={pick} />)}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--s-2)", flex: "none" }}>
          <span className="vn-nav-wide"><CityPicker city={city} cities={cities} onCity={onCity} /></span>
          <span className="vn-nav-wide"><AqiScaleToggle dark={false} /></span>
          <span className="vn-nav-wide" style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>{extras}</span>
          <ThemeToggle dark={false} />
          <button
            onClick={action.onClick}
            title={action.title}
            className="vn-nav-action"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", minHeight: 44,
              borderRadius: "var(--r-sm)", border: "1px solid transparent",
              background: "var(--nav)", color: "var(--nav-ink-strong)",
              fontSize: "var(--t-sm)", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              transition: "box-shadow var(--fast) var(--ease)",
            }}
          >
            {action.label} <span aria-hidden="true">→</span>
          </button>
          <button
            className="vn-nav-narrow"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            style={{ width: 44, height: 44, display: "none", placeItems: "center", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink-2)", cursor: "pointer" }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="vn-nav-sheet vn-sheet" style={{ borderTop: "1px solid var(--line)", background: "var(--surface)", padding: "var(--s-4) var(--s-5)" }}>
          <nav aria-label={`${navLabel} (compact)`} style={{ display: "grid", gap: "var(--s-1)" }}>
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => pick(it.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, width: "100%",
                  padding: "9px 10px", borderRadius: "var(--r-sm)", border: 0, cursor: "pointer", textAlign: "left",
                  background: it.id === activeId ? "var(--primary-soft)" : "transparent",
                }}
              >
                <Text size="sm" weight={700} tone={it.id === activeId ? "primary" : "ink"}>{it.label}</Text>
                {it.hint && <Text size="2xs" tone="muted">{it.hint}</Text>}
              </button>
            ))}
          </nav>
          <div style={{ marginTop: "var(--s-4)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--s-3)" }}>
            <CityPicker city={city} cities={cities} onCity={onCity} />
            <AqiScaleToggle dark={false} />
            {extras}
          </div>
          <button
            onClick={() => { setOpen(false); action.onClick(); }}
            title={action.title}
            style={{
              marginTop: "var(--s-4)", width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "10px 14px", minHeight: 40, borderRadius: "var(--r-sm)", border: 0,
              background: "var(--nav)", color: "var(--nav-ink-strong)",
              fontSize: "var(--t-sm)", fontWeight: 700, cursor: "pointer",
            }}
          >
            {action.label} <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </header>
  );
}

/** The bundled-fixtures notice, identical in both modes. */
export function FallbackNotice() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const off = () => setOn(false);
    const fire = () => setOn(true);
    window.addEventListener("api-fallback", fire);
    window.addEventListener("api-live", off);
    return () => { window.removeEventListener("api-fallback", fire); window.removeEventListener("api-live", off); };
  }, []);
  if (!on) return null;
  return (
    <div role="status" style={{ background: "var(--warn-soft)", borderBottom: "1px solid var(--line)", flex: "none" }}>
      <div style={{ margin: "0 auto", maxWidth: 1360, padding: "6px var(--s-5)", display: "flex", justifyContent: "center", gap: "var(--s-3)" }}>
        <Text size="xs" weight={600} style={{ color: "var(--warn)" }}>
          The backend is waking up — showing the last captured snapshot until it answers.
        </Text>
        <button onClick={() => window.location.reload()} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--warn)", fontSize: "var(--t-xs)", fontWeight: 700, textDecoration: "underline" }}>retry</button>
        <button onClick={() => setOn(false)} aria-label="Dismiss notice" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--warn)", fontSize: "var(--t-xs)" }}><IconX size={14} /></button>
      </div>
    </div>
  );
}
