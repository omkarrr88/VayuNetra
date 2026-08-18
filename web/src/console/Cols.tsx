// Console pages are wide. A panel with three numbers in it should not be 1360px across — it should
// sit beside its neighbour. Cols pairs light panels into two columns and lets a dense one claim
// the whole width, so every card is as wide as its content deserves.
import { type ReactNode } from "react";

export function Cols({ children, gap = 5 }: { children: ReactNode; gap?: 4 | 5 | 6 }) {
  return (
    <div
      className="vn-cols"
      style={{ display: "grid", gap: `var(--s-${gap})`, alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))" }}
    >
      {children}
    </div>
  );
}

/** Escape hatch inside a Cols: this child wants the full width. */
export function Wide({ children }: { children: ReactNode }) {
  return <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>{children}</div>;
}
