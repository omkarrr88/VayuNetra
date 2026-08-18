import type { ReactNode } from "react";
import type { Section } from "../Sidebar";

/** One numbered stop on a section's path. `info` is the plain-language "what is this /
 *  where do the numbers come from / what do I do with it" shown behind the ? on the card. */
export type FlowStep = { n: number; label: string; info: ReactNode };

export type Flow = {
  verb: string;        // one word the officer is doing here
  title: string;       // section title as shown in the rail
  blurb: string;       // one honest sentence — plain language, no jargon
  steps: FlowStep[];   // the path, in order; cards carry the same numbers
};

const P = ({ children }: { children: ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>;

export const FLOWS: Record<Section, Flow> = {
  action: {
    verb: "Act",
    title: "Enforcement",
    blurb: "Where to send an inspector today, with the evidence to back it — from the worst places on the map to a signed notice and a tracked outcome.",
    steps: [
      { n: 1, label: "Morning brief", info: <><P><b>What:</b> the one page a commissioner reads: city air now vs yesterday, the cells about to cross Very Poor (calibrated P ≥ 30 %), the top three actions with notice links, yesterday's dispatches and their measured effect.</P><P><b>Where from:</b> templated over stored measurements, forecasts, the worklist and tracking — no language model. PDF download; one click pushes it to the city's Telegram subscribers.</P><P><b>Then:</b> the map colours every ~1 km cell by its dominant source — click a hexagon for its story.</P></> },
      { n: 2, label: "Ranked worklist", info: <><P><b>What:</b> emission sources ranked by contribution × residents exposed × how actionable they are × model confidence. Sources under 2 % never enter the list.</P><P><b>Where from:</b> per-cell attribution (LightGBM + SHAP, chemical-signature priors) joined to the OSM/registry source layer.</P><P><b>Do:</b> filter by type, open the evidence dossier, draft the notice.</P></> },
      { n: 3, label: "Evidence & notice", info: <><P><b>What:</b> a dossier with the real Sentinel-2 patch of the site, the cited regulation (GRAP/CAQM only where it legally applies; state PCB + CPCB/NCAP elsewhere) and a draft notice PDF naming the issuing authority.</P><P><b>Honesty:</b> notices are drafts for an officer's signature — never auto-sent; every number is read from model output, none written by an LLM (see the PROVENANCE section).</P></> },
      { n: 4, label: "Dispatch by ward", info: <><P><b>What:</b> the same worklist grouped into ward queues so a zonal officer sees only their patch.</P><P><b>Do:</b> mark items dispatched — that freezes the 7-day PM2.5 baseline for the before/after measurement.</P></> },
      { n: 5, label: "Track outcomes", info: <><P><b>What:</b> every dispatched intervention with its measured before/after PM2.5 (drift-corrected against the city) and a PRANA-ready CSV export.</P><P><b>Why:</b> this is the outcome monitoring India's official DSS lacks (CEEW 2025).</P></> },
    ],
  },
  forecast: {
    verb: "Anticipate",
    title: "Forecast",
    blurb: "What the air will do in the next 72 hours, how much to trust that, who it will affect — and what happened before.",
    steps: [
      { n: 1, label: "72-hour outlook", info: <><P><b>What:</b> per-cell PM2.5 at +24/48/72 h with an 80 % band (conformal-calibrated) and the persistence baseline for comparison.</P><P><b>Model:</b> LightGBM quantile regression retrained daily per city on the trailing 90 days; features = station pollutants, ERA5 weather, calendar, lags, upwind advection.</P></> },
      { n: 2, label: "How good is it, really", info: <><P><b>What:</b> the strict temporal-split benchmark — skill vs persistence and seasonal-naive, winter and high-pollution slices, interval coverage, and how many clean→Very-Poor onsets the model warns of (persistence = 0 by construction).</P><P><b>Where from:</b> <code>python -m ml.eval.benchmark</code> on real station data; the API serves the artifact unchanged. Negative numbers stay.</P></> },
      { n: 3, label: "Real orders, in hindsight", info: <><P><b>What:</b> the CAQM GRAP escalations of winter 2025-26 (and Diwali night), dated from government releases, replayed against the served forecast — what P(&gt;120) it carried 24/48/72 h before each order — and a weather-normalised check of whether the air changed during the window.</P><P><b>Where from:</b> <code>python -m ml.eval.interventions</code>; negative results and low-coverage rows are kept. Association, not causation.</P></> },
      { n: 4, label: "Who is in the forecast", info: <><P><b>What:</b> expected people in Very Poor / Severe air = Σ cell population × calibrated P(&gt; band); GPW population where sampled, cited city population otherwise. Exposure, not mortality.</P></> },
      { n: 5, label: "The past", info: <><P><b>What:</b> daily station means for 30 d / 90 d / 1 y with a plain-language verdict and spike-day markers, plus the last 48 h and the live source mix.</P></> },
    ],
  },
  citizen: {
    verb: "Inform",
    title: "Advisories",
    blurb: "Tell residents what to do, in their language, on the channel they actually use — and let them tell you where it smells like smoke.",
    steps: [
      { n: 1, label: "Advisories by ward", info: <><P><b>What:</b> ward-level health advisories tiered by forecast risk and vulnerability (schools, hospitals, elderly), in the city's languages.</P><P><b>Honesty:</b> health text is templated (LLM-free by design); an optional LLM fluency polish is gated by a facts check and a script check.</P></> },
      { n: 2, label: "Send it", info: <><P><b>What:</b> broadcast to Telegram, a real IVR voice call, and public display boards; share a WhatsApp-ready card for any place.</P></> },
      { n: 3, label: "Clean-air routes", info: <><P><b>What:</b> clean-air zones and exposure corridors — where a commute or a school run breathes least.</P></> },
      { n: 4, label: "Citizen reports", info: <><P><b>What:</b> residents report smoke, dust or burning with a photo; verified reports become emission sources in the enforcement worklist — the loop closes.</P></> },
    ],
  },
  compare: {
    verb: "Compare",
    title: "Cities",
    blurb: "Ten cities on one scoreboard: who is worse, what is driving it, and which playbook worked elsewhere.",
    steps: [
      { n: 1, label: "Scoreboard", info: <><P><b>What:</b> the ten cities ranked by current PM2.5 with trend, dominant source and enforcement load; click a city to switch the whole console.</P></> },
      { n: 2, label: "What worked elsewhere", info: <><P><b>What:</b> playbook recommendations drawn from the comparison — the interventions that moved the needle in a similar city.</P></> },
    ],
  },
  whatif: {
    verb: "Decide",
    title: "Simulator",
    blurb: "Before spending money: run an intervention on the model and read the ΔPM2.5, the people protected and the health ₹ — with citations.",
    steps: [
      { n: 1, label: "Choose an intervention", info: <><P><b>What:</b> pick an action (waste-burn ban, construction halt, traffic restriction…) and where it applies.</P></> },
      { n: 2, label: "Run & read the result", info: <><P><b>What:</b> counterfactual over attribution shares × forecasts (E3) with cited WHO AirQ+ health economics (E7). Missing inputs return null, never a made-up number.</P></> },
      { n: 3, label: "Best bundle for a budget", info: <><P><b>What:</b> the optimiser ranks intervention bundles under a rupee budget.</P></> },
    ],
  },
  impact: {
    verb: "Fund",
    title: "Impact",
    blurb: "The funding case: this city's annual health burden, what the NCAP target would avert, where the money should go — and whether the system is fair.",
    steps: [
      { n: 1, label: "The funding case", info: <><P><b>What:</b> annual premature deaths and ₹ health cost from the cited annual PM2.5, and what a 30 % NCAP-target cut would avert.</P></> },
      { n: 2, label: "Where funds should go", info: <><P><b>What:</b> attribution-weighted guidance across NCAP spending heads.</P></> },
      { n: 3, label: "Is it fair?", info: <><P><b>What:</b> an audit of what drives enforcement priority — pollution contribution dominates by design; no income or demographic field exists in the schema.</P></> },
    ],
  },
  pipeline: {
    verb: "Trust",
    title: "Pipeline",
    blurb: "The six AI agents, run live in front of you — every step traced, every number sourced.",
    steps: [
      { n: 1, label: "Run the agents", info: <><P><b>What:</b> the LangGraph orchestrator: ingest → attribution → forecast → enforcement → advisory → comparison; each node's inputs, outputs and timing are traced.</P></> },
      { n: 2, label: "Read the trace", info: <><P><b>What:</b> per-node inputs, outputs and wall-clock; end-to-end latency from signal to issued advisory. Nothing here is a mock — the button really runs the graph against the live database.</P></> },
    ],
  },
};
