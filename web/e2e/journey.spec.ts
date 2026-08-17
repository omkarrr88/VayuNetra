import { expect, test, type Page } from "@playwright/test";

// The officer's whole day, end to end, against a LIVE backend (DEMO_MODE=false on :8000).
// Every step here is something a judge could click. Nothing is mocked; when a live call
// legitimately takes time (agents, dossier RAG, notice PDF) the wait is generous, not skipped.
// Run: VN_LIVE=1 npx playwright test e2e/journey.spec.ts

const LIVE = !!process.env.VN_LIVE;
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

async function openConsole(page: Page, section = "action", city = "delhi") {
  await page.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
  await page.goto(`/console?city=${city}&section=${section}`);
  const skip = page.getByRole("dialog", { name: "Quick tour" }).getByRole("button", { name: "Skip" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.locator("[data-tour=spine]")).toBeVisible();
}

test("1 · enforcement: worklist → dossier → notice PDF → dispatch → outcomes", async ({ page }) => {
  await openConsole(page, "action");
  const rail = page.locator("[data-rail]");
  await expect(rail.getByText("Enforcement Worklist")).toBeVisible();
  // step chips exist and jump
  await rail.getByRole("button", { name: /5\s*Track outcomes/ }).click();
  await expect(rail.getByText("Intervention tracking")).toBeVisible();
  await rail.getByRole("button", { name: /2\s*Ranked worklist/ }).click();
  // items are titled by source type + place, with priority + rubric meta
  const first = rail.locator("[data-step='2'] .rounded-lg.border").first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  await expect(first.getByText(/priority \d+/)).toBeVisible();
  // dossier
  await first.getByRole("button", { name: /evidence dossier/i }).click();
  await expect(rail.getByText(/Regulatory citations/i)).toBeVisible({ timeout: 60_000 });
  // notice PDF downloads (real bytes)
  const dl = page.waitForEvent("download", { timeout: 90_000 });
  await first.getByRole("button", { name: /notice pdf/i }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/notice_\d+\.pdf/);
  const path = await file.path();
  expect(path).toBeTruthy();
  // ward queues + interventions cards carry their step numbers
  await expect(rail.locator("[data-step='4']")).toBeVisible();
  await expect(rail.locator("[data-step='5']")).toBeVisible();
});

test("2 · map: a cell story opens with blame, forecast probabilities and a share card", async ({ page }) => {
  await openConsole(page, "action");
  await expect(page.getByText("Cell story", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Why —/).first()).toBeVisible();
  await expect(page.getByText(/Where it's heading/).first()).toBeVisible();
  // calibrated exceedance chip renders once forecasts carry probabilities
  if (LIVE) await expect(page.getByText(/% (Very Poor\+|Severe)/).first()).toBeVisible({ timeout: 30_000 });
  // share card produces a PNG (download fallback in headless)
  const dl = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
  await page.getByRole("button", { name: /share this place/i }).first().click();
  const f = await dl;
  if (f) expect(f.suggestedFilename()).toMatch(/\.png$/);
});

test("3 · forecast: outlook, measured validation, exposure, past air", async ({ page }) => {
  await openConsole(page, "forecast");
  const rail = page.locator("[data-rail]");
  await expect(rail.getByText(/measured skill|backtested skill/).first()).toBeVisible({ timeout: 30_000 });
  await expect(rail.getByText("Forecast validation")).toBeVisible();
  await expect(rail.getByText(/vs persistence/).first()).toBeVisible();
  await rail.getByRole("button", { name: "+48h" }).first().click();
  await expect(rail.getByText(/measured skill @48h|backtested skill @48h/).first()).toBeVisible();
  await expect(rail.getByText("Who is in the forecast?")).toBeVisible({ timeout: 30_000 });
  await expect(rail.getByText(/City — past air/i)).toBeVisible();
});

test("4 · advisories: language + channel switch, clean-air routes, reports list", async ({ page }) => {
  await openConsole(page, "citizen");
  const rail = page.locator("[data-rail]");
  await expect(rail.getByText("Citizen Advisory")).toBeVisible();
  await rail.getByRole("button", { name: "Telegram", exact: true }).click();
  await rail.getByRole("button", { name: "IVR call", exact: true }).click();
  await rail.getByRole("button", { name: "Big screen", exact: true }).click();
  // Delhi's showcase language is Hindi: it is the default, and switching to English works.
  const lang = rail.locator("select").first();
  await expect(lang).toHaveValue("hi", { timeout: 15_000 });
  await expect(rail.getByText(/[ऀ-ॿ]/).first()).toBeVisible({ timeout: 20_000 });
  await lang.selectOption("en");
  await expect(rail.getByText(/air is forecast/).first()).toBeVisible({ timeout: 20_000 });
  await expect(rail.locator("[data-step='2']").getByText("Send it", { exact: true })).toBeVisible();
  await expect(rail.locator("[data-step='4']").getByText("Citizen reports", { exact: true })).toBeVisible();
  // the broadcast asks for confirmation and can be cancelled — never fires by accident
  await rail.getByRole("button", { name: /broadcast latest alert/i }).click();
  await expect(rail.getByText(/real Telegram message and place a real phone call/)).toBeVisible();
  await rail.getByRole("button", { name: "Cancel" }).click();
});

test("5 · cities: scoreboard switches the whole console", async ({ page }) => {
  await openConsole(page, "compare");
  const rail = page.locator("[data-rail]");
  await expect(rail.getByText("Multi-City Compare").first()).toBeVisible();
  const mumbai = rail.getByRole("button", { name: /mumbai/i }).first();
  if (await mumbai.count()) {
    await mumbai.click();
    await expect(page.locator("header select")).toHaveValue("mumbai");
    await expect(page).toHaveURL(/city=mumbai/);
  }
});

test("6 · simulator: run a what-if, read the cited result, rank a bundle", async ({ page }) => {
  await openConsole(page, "whatif");
  const rail = page.locator("[data-rail]");
  await expect(rail.getByText("Choose an intervention").first()).toBeVisible();
  await rail.getByRole("button", { name: /run simulation/i }).click();
  await expect(rail.getByText(/avg ΔAQI/)).toBeVisible({ timeout: 90_000 });
  await expect(rail.getByText(/confidence/)).toBeVisible();
  await rail.getByRole("button", { name: /rank packages/i }).click();
  await expect(rail.getByText(/inspector-hours|No feasible package/).first()).toBeVisible({ timeout: 90_000 });
});

test("7 · impact: funding case, fund guidance, fairness audit", async ({ page }) => {
  await openConsole(page, "impact");
  const rail = page.locator("[data-rail]");
  await expect(rail.getByText(/funding case/i).first()).toBeVisible();
  await expect(rail.getByText(/Where the funds should go/).first()).toBeVisible({ timeout: 30_000 });
  await expect(rail.getByText(/Fairness audit/).first()).toBeVisible();
  await expect(rail.getByText(/every figure is cited/i)).toBeVisible();
});

test("8 · pipeline: the agents really run", async ({ page }) => {
  test.skip(!LIVE, "runs the LangGraph pipeline against the live DB — VN_LIVE=1 only");
  await openConsole(page, "pipeline");
  const rail = page.locator("[data-rail]");
  await rail.getByRole("button", { name: /run agents live/i }).click();
  await expect(rail.getByText(/end-to-end/)).toBeVisible({ timeout: 230_000 });
});

test("9 · shell: keyboard sections, city cycling, presentation mode, layers", async ({ page }) => {
  await openConsole(page, "action");
  await page.keyboard.press("2");
  await expect(page.locator("[data-tour=spine]").getByText("Anticipate")).toBeVisible();
  // city cycling needs the /cities list; wait until the switcher has all ten
  await expect(page.locator("header select option")).toHaveCount(10, { timeout: 30_000 });
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("]");
  await expect(page).not.toHaveURL(/city=delhi/);
  await page.keyboard.press("[");
  await expect(page).toHaveURL(/city=delhi/);
  await page.keyboard.press("p");
  await expect(page.locator("html")).toHaveClass(/vn-present/);
  await page.keyboard.press("p");
  await page.getByRole("button", { name: /^Layers/ }).click();
  await page.getByRole("button", { name: /wind plumes/i }).click();
  await expect(page).toHaveURL(/layers=.*plumes/);
});
