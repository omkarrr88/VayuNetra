# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web/e2e/journey.spec.ts >> 1 · enforcement: worklist → dossier → notice PDF → dispatch → outcomes
- Location: web/e2e/journey.spec.ts:23:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/console?city=delhi&section=action", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | // The officer's whole day, end to end, against a LIVE backend (DEMO_MODE=false on :8000).
  4   | // Every step here is something a judge could click. Nothing is mocked; when a live call
  5   | // legitimately takes time (agents, dossier RAG, notice PDF) the wait is generous, not skipped.
  6   | // Run: VN_LIVE=1 npx playwright test e2e/journey.spec.ts
  7   | 
  8   | const LIVE = !!process.env.VN_LIVE;
  9   | test.describe.configure({ mode: "serial" });
  10  | test.setTimeout(240_000);
  11  | // The journey needs the live API (DEMO_MODE=false) on :8000 — real dossiers, PDFs, agents.
  12  | // Without VN_LIVE the whole file is skipped so the default smoke run stays offline-safe.
  13  | test.beforeEach(() => test.skip(!LIVE, "set VN_LIVE=1 with the live API on :8000"));
  14  | 
  15  | async function openConsole(page: Page, section = "action", city = "delhi") {
  16  |   await page.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
> 17  |   await page.goto(`/console?city=${city}&section=${section}`);
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  18  |   const skip = page.getByRole("dialog", { name: "Quick tour" }).getByRole("button", { name: "Skip" });
  19  |   if (await skip.isVisible().catch(() => false)) await skip.click();
  20  |   await expect(page.locator("[data-tour=spine]")).toBeVisible();
  21  | }
  22  | 
  23  | test("1 · enforcement: worklist → dossier → notice PDF → dispatch → outcomes", async ({ page }) => {
  24  |   await openConsole(page, "action");
  25  |   const rail = page.locator("[data-rail]");
  26  |   // the section is one page: every numbered card is mounted, so a step is scrolled to, not selected
  27  |   // step 1: the morning brief renders from stored rows and downloads as a PDF
  28  |   const briefCard = rail.locator("[data-step='1']");
  29  |   await expect(briefCard.getByText("Morning brief")).toBeVisible({ timeout: 30_000 });
  30  |   await expect(briefCard.getByText(/Top actions today/i)).toBeVisible();
  31  |   const briefDl = page.waitForEvent("download", { timeout: 60_000 });
  32  |   await briefCard.getByRole("button", { name: "PDF" }).click();
  33  |   expect((await briefDl).suggestedFilename()).toMatch(/brief_delhi\.pdf/);
  34  |   // step chips exist and jump
  35  |   await page.locator("[data-step='5']").scrollIntoViewIfNeeded();
  36  |   await expect(rail.getByText("Intervention tracking")).toBeVisible();
  37  |   await page.locator("[data-step='2']").scrollIntoViewIfNeeded();
  38  |   // items are titled by source type + place, with priority + rubric meta
  39  |   const first = rail.locator("[data-step='2'] .rounded-lg.border").first();
  40  |   await expect(first).toBeVisible({ timeout: 30_000 });
  41  |   await expect(first.getByText(/priority \d+/)).toBeVisible();
  42  |   // dossier
  43  |   await first.getByRole("button", { name: /evidence dossier/i }).click();
  44  |   await expect(rail.getByText(/Regulatory citations/i)).toBeVisible({ timeout: 60_000 });
  45  |   // notice PDF downloads (real bytes)
  46  |   const dl = page.waitForEvent("download", { timeout: 90_000 });
  47  |   await first.getByRole("button", { name: /notice pdf/i }).click();
  48  |   const file = await dl;
  49  |   expect(file.suggestedFilename()).toMatch(/notice_\d+\.pdf/);
  50  |   const path = await file.path();
  51  |   expect(path).toBeTruthy();
  52  |   // officer loop: approve → dispatch on the first still-proposed card; the ward queue and the
  53  |   // tracker refetch on the change event (this is a REAL dispatch on the live DB — that is the point)
  54  |   // all steps are on the page; nothing to select
  55  |   const cards = rail.locator("[data-step='2'] .rounded-lg.border");
  56  |   const n = await cards.count();
  57  |   let idx = -1;
  58  |   for (let i = 0; i < n; i++) if (await cards.nth(i).getByRole("button", { name: "Approve" }).count()) { idx = i; break; }
  59  |   if (idx >= 0) {
  60  |     const card = cards.nth(idx); // stable index — the list keeps its order across status changes
  61  |     await card.getByRole("button", { name: "Approve" }).click();
  62  |     await expect(card.getByRole("button", { name: /dispatch team/i })).toBeVisible({ timeout: 20_000 });
  63  |     await card.getByRole("button", { name: /dispatch team/i }).click();
  64  |     await expect(card.getByText(/Dispatched · tracking armed/)).toBeVisible({ timeout: 30_000 });
  65  |     // close the case with a field finding; the audit trail must show every step with the actor
  66  |     await rail.getByLabel("Acting officer name").fill("Journey test");
  67  |     await card.getByRole("button", { name: "Close case" }).click();
  68  |     await card.getByLabel("Closure finding").selectOption("not_applicable");
  69  |     await card.getByLabel("Closure note").fill("e2e journey — no field visit");
  70  |     await card.getByRole("button", { name: /Record & close/ }).click();
  71  |     await expect(card.getByText(/Closed · not applicable/)).toBeVisible({ timeout: 30_000 });
  72  |     await card.getByRole("button", { name: "History" }).click();
  73  |     await expect(card.getByText(/by Journey test/).first()).toBeVisible({ timeout: 30_000 });
  74  |   }
  75  |   // ward queues + interventions cards carry their step numbers and now have content
  76  |   // each step is a tab now: select it, then assert its card (queues may be empty after a close —
  77  |   // the honest empty state counts)
  78  |   // all steps are on the page; nothing to select
  79  |   await expect(rail.locator("[data-step='4']").getByText(/in queue|Nothing dispatched yet/).first()).toBeVisible({ timeout: 30_000 });
  80  |   // all steps are on the page; nothing to select
  81  |   await expect(rail.locator("[data-step='5']").getByText(/provisional|Δ|baseline|dispatched|tracking arms/i).first()).toBeVisible({ timeout: 30_000 });
  82  | });
  83  | 
  84  | test("2 · map: a cell story opens with blame, forecast probabilities and a share card", async ({ page }) => {
  85  |   await openConsole(page, "action");
  86  |   await expect(page.getByText("Cell story", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  87  |   await expect(page.getByText(/Why —/).first()).toBeVisible();
  88  |   await expect(page.getByText(/Where it's heading/).first()).toBeVisible();
  89  |   // calibrated exceedance chip renders once forecasts carry probabilities
  90  |   if (LIVE) await expect(page.getByText(/% (Very Poor|Severe)/).first()).toBeVisible({ timeout: 30_000 });
  91  |   // share card produces a PNG (download fallback in headless)
  92  |   const dl = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
  93  |   await page.getByRole("button", { name: /share this place/i }).first().click();
  94  |   const f = await dl;
  95  |   if (f) expect(f.suggestedFilename()).toMatch(/\.png$/);
  96  | });
  97  | 
  98  | test("3 · forecast: outlook, measured validation, exposure, past air", async ({ page }) => {
  99  |   await openConsole(page, "forecast");
  100 |   const rail = page.locator("[data-rail]");
  101 |   // tab 1 — the outlook
  102 |   await expect(rail.getByText(/measured skill|backtested skill/).first()).toBeVisible({ timeout: 30_000 });
  103 |   await rail.getByRole("button", { name: "+48h" }).first().click();
  104 |   await expect(rail.getByText(/measured skill @48h|backtested skill @48h/).first()).toBeVisible();
  105 |   // tab 2 — the benchmark, with the attribution-method breakdown under it
  106 |   // all steps are on the page; nothing to select
  107 |   await expect(rail.getByText("Forecast validation")).toBeVisible({ timeout: 20_000 });
  108 |   await expect(rail.getByText(/vs persistence/).first()).toBeVisible();
  109 |   // tab 4 — exposure; tab 5 — the past
  110 |   // all steps are on the page; nothing to select
  111 |   await expect(rail.getByText("Who is in the forecast?")).toBeVisible({ timeout: 30_000 });
  112 |   // all steps are on the page; nothing to select
  113 |   await expect(rail.getByText(/City — past air/i)).toBeVisible({ timeout: 20_000 });
  114 | });
  115 | 
  116 | test("4 · advisories: language + channel switch, clean-air routes, reports list", async ({ page }) => {
  117 |   await openConsole(page, "citizen");
```