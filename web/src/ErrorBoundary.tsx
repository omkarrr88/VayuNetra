// Top-level safety net: a render-time throw in any panel must never blank the
// whole app in front of a judge. Catch it, show a branded fallback, offer reload.
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept minimal on purpose: surfaces in the browser console for debugging,
    // wire to Sentry here if/when added.
    if (typeof console !== "undefined") {
      console.error("VayuNetra render error:", error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-950 p-6 text-center text-slate-200">
          <div className="max-w-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500 text-lg font-black text-white">
              V
            </div>
            <h1 className="mt-4 text-lg font-bold text-white">Something hiccuped</h1>
            <p className="mt-2 text-sm text-slate-500">
              A panel failed to render. The rest of the platform is fine — reload to recover.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
            >
              Reload
            </button>
            <p className="mt-3 font-mono text-[11px] text-slate-600">{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
