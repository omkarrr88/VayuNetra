// The primitives every panel is built from. They read only design/tokens.css, so type, spacing,
// elevation and motion stay consistent by construction and both themes are correct for free.
//
// Rules for panels: never set a font size, colour or shadow directly — compose these.
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ------------------------------------------------------------------ text ---- */
type TextTone = "ink" | "ink2" | "muted" | "faint" | "primary" | "accent" | "warn" | "danger" | "inherit";
type TextSize = "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "display";
const TONE: Record<TextTone, string> = {
  ink: "var(--ink)", ink2: "var(--ink-2)", muted: "var(--muted)", faint: "var(--faint)",
  primary: "var(--primary)", accent: "var(--accent)", warn: "var(--warn)", danger: "var(--danger)", inherit: "inherit",
};
const SIZE: Record<TextSize, string> = {
  "2xs": "var(--t-2xs)", xs: "var(--t-xs)", sm: "var(--t-sm)", md: "var(--t-md)",
  lg: "var(--t-lg)", xl: "var(--t-xl)", display: "var(--t-display)",
};

export function Text({
  as: As = "span", size = "sm", tone = "ink2", weight = 400, uppercase = false, tight = false, className = "", style, children, ...rest
}: {
  as?: React.ElementType; size?: TextSize; tone?: TextTone; weight?: 400 | 600 | 700 | 800;
  uppercase?: boolean; tight?: boolean; className?: string; style?: CSSProperties; children: ReactNode;
} & Record<string, unknown>) {
  return (
    <As
      className={className}
      style={{
        fontSize: SIZE[size], color: TONE[tone], fontWeight: weight,
        lineHeight: tight ? "var(--lh-tight)" : "var(--lh-snug)",
        letterSpacing: uppercase ? "var(--tracking-wide)" : size === "xl" || size === "display" ? "var(--tracking-tight)" : undefined,
        textTransform: uppercase ? "uppercase" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Section eyebrow: small, spaced, quiet — the label above a title. */
export const Kicker = ({ children }: { children: ReactNode }) => (
  <Text size="2xs" tone="muted" weight={700} uppercase>{children}</Text>
);

/* ---------------------------------------------------------------- surface ---- */
export function Surface({
  level = 1, pad = 4, radius = "md", glass = false, className = "", style, children, ...rest
}: {
  level?: 0 | 1 | 2 | 3; pad?: 0 | 2 | 3 | 4 | 5 | 6; radius?: "sm" | "md" | "lg" | "xl" | "full";
  glass?: boolean; className?: string; style?: CSSProperties; children: ReactNode;
} & Record<string, unknown>) {
  const shadow = level === 0 ? "var(--e-0)" : level === 1 ? "var(--e-1)" : level === 2 ? "var(--e-2)" : "var(--e-3)";
  return (
    <div
      className={className}
      style={{
        background: glass ? "var(--glass)" : "var(--surface)",
        backdropFilter: glass ? "saturate(1.4) blur(14px)" : undefined,
        border: `1px solid ${glass ? "var(--glass-line)" : "var(--line)"}`,
        borderRadius: `var(--r-${radius})`,
        boxShadow: shadow,
        padding: pad ? `var(--s-${pad})` : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ stack ---- */
export function Stack({ gap = 3, row = false, wrap = false, align, justify, className = "", style, children }: {
  gap?: 1 | 2 | 3 | 4 | 5 | 6; row?: boolean; wrap?: boolean; align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"]; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: row ? "row" : "column", gap: `var(--s-${gap})`, flexWrap: wrap ? "wrap" : undefined, alignItems: align, justifyContent: justify, minWidth: 0, ...style }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ chip ----- */
export function Chip({ tone = "neutral", solid = false, children, title, style }: {
  tone?: "neutral" | "primary" | "accent" | "warn" | "danger"; solid?: boolean; children: ReactNode; title?: string; style?: CSSProperties;
}) {
  const c = tone === "neutral" ? "var(--muted)" : `var(--${tone})`;
  const soft = tone === "neutral" ? "var(--surface-3)" : `var(--${tone}-soft)`;
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: "var(--s-1)",
        padding: "2px 8px", borderRadius: "var(--r-full)",
        background: solid ? c : soft, color: solid ? "#fff" : c,
        fontSize: "var(--t-2xs)", fontWeight: 700, letterSpacing: "var(--tracking-wide)", textTransform: "uppercase",
        whiteSpace: "nowrap", ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- button ----- */
export function Button({
  variant = "quiet", size = "md", full = false, children, style, ...rest
}: {
  variant?: "primary" | "quiet" | "ghost" | "danger"; size?: "sm" | "md"; full?: boolean; children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const pad = size === "sm" ? "5px 10px" : "8px 14px";
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--s-2)",
    padding: pad, borderRadius: "var(--r-sm)", fontSize: size === "sm" ? "var(--t-xs)" : "var(--t-sm)",
    fontWeight: 700, cursor: "pointer", minHeight: size === "sm" ? 28 : 34, width: full ? "100%" : undefined,
    transition: `background var(--fast) var(--ease), color var(--fast) var(--ease), box-shadow var(--fast) var(--ease), transform var(--fast) var(--ease)`,
    border: "1px solid transparent",
  };
  const look: Record<string, CSSProperties> = {
    primary: { background: "var(--primary)", color: "var(--primary-ink)", boxShadow: "var(--e-1)" },
    danger: { background: "var(--danger)", color: "#fff", boxShadow: "var(--e-1)" },
    quiet: { background: "var(--surface-2)", color: "var(--ink-2)", borderColor: "var(--line)" },
    ghost: { background: "transparent", color: "var(--muted)" },
  };
  return (
    <button
      {...rest}
      className={`vn-btn ${rest.className ?? ""}`}
      style={{ ...base, ...look[variant], ...style }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ tabs ----- */
export function Tabs({ items, value, onChange, size = "md", label }: {
  items: { id: string; label: ReactNode; badge?: ReactNode; title?: string }[];
  value: string; onChange: (id: string) => void; size?: "sm" | "md"; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-1)" }}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={on}
            title={it.title}
            onClick={() => onChange(it.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "var(--s-1)",
              padding: size === "sm" ? "4px 9px" : "6px 12px",
              minHeight: size === "sm" ? 26 : 30,
              borderRadius: "var(--r-full)",
              fontSize: size === "sm" ? "var(--t-xs)" : "var(--t-sm)", fontWeight: 700,
              background: on ? "var(--primary)" : "var(--surface-2)",
              color: on ? "var(--primary-ink)" : "var(--muted)",
              border: `1px solid ${on ? "transparent" : "var(--line)"}`,
              cursor: "pointer",
              transition: "background var(--fast) var(--ease), color var(--fast) var(--ease)",
            }}
          >
            {it.badge}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- metric ----- */
/** A number that counts up when it changes — the app's one piece of showmanship,
 *  disabled under prefers-reduced-motion by the CSS class it rides on. */
export function Metric({ value, unit, tone, size = "metric", decimals = 0, label }: {
  value: number | null | undefined; unit?: ReactNode; tone?: string; size?: "metric" | "display" | "xl";
  decimals?: number; label?: ReactNode;
}) {
  const [shown, setShown] = useState(value ?? 0);
  const raf = useRef(0);
  useEffect(() => {
    if (value === null || value === undefined) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(value); return; }
    const from = shown, to = value, t0 = performance.now(), dur = 520;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const fs = size === "metric" ? "var(--t-metric)" : size === "display" ? "var(--t-display)" : "var(--t-xl)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-2)", minWidth: 0 }}>
        <span style={{ fontSize: fs, fontWeight: 800, lineHeight: "var(--lh-tight)", letterSpacing: "var(--tracking-tight)", color: tone ?? "var(--ink)" }}>
          {value === null || value === undefined ? "–" : shown.toFixed(decimals)}
        </span>
        {unit && <Text size="xs" tone="muted" weight={700} style={{ paddingBottom: 6 }}>{unit}</Text>}
      </div>
      {label && <Text size="xs" tone="muted">{label}</Text>}
    </div>
  );
}

/* ------------------------------------------------------------- card + step --- */
export type StepInfo = { n: number; label: string; info?: ReactNode };
export const StepContext = createContext<StepInfo | null>(null);
export const useStep = () => useContext(StepContext);

/** The one card in the product: optional step badge, title, tag, right slot, "?" help. */
export function Card({ title, tag, right, info, pad = 4, level = 1, glass = false, className = "", children }: {
  title?: ReactNode; tag?: ReactNode; right?: ReactNode; info?: ReactNode;
  pad?: 0 | 2 | 3 | 4 | 5 | 6; level?: 0 | 1 | 2 | 3; glass?: boolean; className?: string; children: ReactNode;
}) {
  const step = useStep();
  const tip = info ?? step?.info;
  return (
    <Surface level={level} pad={pad} glass={glass} className={className}>
      {(title !== undefined || right) && (
        <Stack row align="center" justify="space-between" gap={2} style={{ marginBottom: "var(--s-3)" }}>
          <Stack row align="center" gap={2} style={{ minWidth: 0 }}>
            {step && (
              <span aria-label={`Step ${step.n}`} style={{
                display: "inline-grid", placeItems: "center", width: 20, height: 20, flex: "none",
                borderRadius: "var(--r-full)", background: "var(--primary)", color: "var(--primary-ink)",
                fontSize: "var(--t-2xs)", fontWeight: 800,
              }}>{step.n}</span>
            )}
            <Text size="md" weight={700} tone="ink" tight style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Text>
            {tag && <Chip>{tag}</Chip>}
          </Stack>
          <Stack row align="center" gap={2} style={{ flex: "none" }}>
            {right}
            {tip && <InfoTip>{tip}</InfoTip>}
          </Stack>
        </Stack>
      )}
      {children}
    </Surface>
  );
}

/* --------------------------------------------------------------- info tip ---- */
export function InfoTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="What is this?"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{
          width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: "var(--r-full)",
          border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--muted)",
          fontSize: "var(--t-xs)", fontWeight: 800, cursor: "help",
        }}
      >?</button>
      {open && (
        <Surface level={3} pad={3} radius="md" className="vn-sheet" style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, zIndex: 40,
          fontSize: "var(--t-sm)", lineHeight: "var(--lh-body)", color: "var(--ink-2)",
        }}>
          {children}
        </Surface>
      )}
    </span>
  );
}

/* ------------------------------------------------------- loading + empty ----- */
export const Skeleton = ({ h = 80, className = "" }: { h?: number; className?: string }) => (
  <div className={`vn-skeleton ${className}`} style={{ height: h }} aria-hidden="true" />
);

export function Loading({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <Stack gap={2}>
        {Array.from({ length: lines }, (_, i) => <Skeleton key={i} h={i === 0 ? 28 : 16} />)}
      </Stack>
    </div>
  );
}

export function Empty({ message, action }: { message: ReactNode; action?: ReactNode }) {
  return (
    <Stack gap={2} align="flex-start" style={{ padding: "var(--s-4)", background: "var(--surface-2)", borderRadius: "var(--r-md)" }}>
      <Text size="sm" tone="muted">{message}</Text>
      {action}
    </Stack>
  );
}

/* ----------------------------------------------------------------- toast ----- */
type Toast = { id: number; text: string; tone: "accent" | "danger" | "primary" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/** Officer actions are consequential; every one gets a spoken-aloud confirmation. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = (text: string, tone: Toast["tone"] = "accent") => {
    const id = Date.now() + Math.random();
    setItems((v) => [...v, { id, text, tone }]);
    setTimeout(() => setItems((v) => v.filter((t) => t.id !== id)), 4200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" style={{ position: "fixed", bottom: "var(--s-5)", left: "50%", transform: "translateX(-50%)", zIndex: 80, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {items.map((t) => (
          <Surface key={t.id} level={3} pad={3} radius="full" className="vn-sheet" glass style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", borderRadius: "var(--r-full)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "var(--r-full)", background: `var(--${t.tone})`, flex: "none" }} />
            <Text size="sm" tone="ink" weight={600}>{t.text}</Text>
          </Surface>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
