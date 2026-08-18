import { useEffect, useRef, useState, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

/** A `ResponsiveContainer` that only mounts its chart once the parent box has a real size.
 *  Charts inside collapsed / not-yet-laid-out sections otherwise log recharts'
 *  "width(0) and height(0)" warning on first paint. Fills the parent (100% × 100%). */
export default function SizedChart({ children, minHeight = 0 }: { children: ReactElement; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setReady(el.clientWidth > 0 && el.clientHeight > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="h-full w-full" style={minHeight ? { minHeight } : undefined}>
      {ready ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : null}
    </div>
  );
}
