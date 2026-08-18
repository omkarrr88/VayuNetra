import { createContext, useContext } from "react";

/** Shared state for the tabbed section rail. Kept in its own module so `ui.tsx` (Step) and
 *  `railTabs.tsx` (the provider + tab bar) can both use it without a circular import.
 *  `null` outside a rail — public pages render every Step normally. */
export type RailState = { active: number; setActive: (n: number) => void; register: (n: number) => void; steps: number[] };
export const RailContext = createContext<RailState | null>(null);
export function useRail(): RailState | null { return useContext(RailContext); }

/** Which step's card is displayed for the requested tab. A step whose content lives inside another
 *  card (Evidence & notice) or that has not mounted yet (a card still fetching) falls back to the
 *  nearest lower step that does have a card — never to the top of the section. */
export function shownStep(active: number, steps: number[]): number {
  if (steps.includes(active)) return active;
  const lower = steps.filter((s) => s < active);
  if (lower.length) return Math.max(...lower);
  return steps[0] ?? active;
}
