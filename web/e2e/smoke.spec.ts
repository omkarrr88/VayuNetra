import { expect, test } from "@playwright/test";

// The core judge journey: land → open console → see the auto-opened cell story
// → switch to the enforcement worklist → open a dossier. Deterministic parts
// only (no fixed-coordinate canvas clicks).

// Every test except the tour test pre-seeds the "tour seen" flag — a fresh
// browser context would otherwise get the first-run overlay blocking clicks.
test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes("first-run tour")) {
    await page.addInitScript(() => localStorage.setItem("vayunetra-tour-v1", "done"));
  }
});

test("landing renders and links into the console", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /operations layer for urban air quality/i })).toBeVisible();
  await page.getByRole("link", { name: /open the console/i }).first().click();
  await expect(page).toHaveURL(/\/console$/);
});

test("first-run tour shows once, then never again", async ({ page }) => {
  // legacy hash URL (old QR codes) must upgrade to the clean path
  await page.goto("/#/console");
  await expect(page).toHaveURL(/\/console$/);
  const dialog = page.getByRole("dialog", { name: "Quick tour" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Skip" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Console sections" }).first()).toBeVisible();
  await expect(dialog).toBeHidden();
});

test("console loads the sidebar shell and the layer control", async ({ page }) => {
  await page.goto("/console");
  const sidebar = page.getByRole("navigation", { name: "Console sections" }).first();
  await expect(sidebar.getByRole("button", { name: "Enforcement" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Simulator" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Pipeline" })).toBeVisible();
  // Layer control starts as a compact chip; it expands on click.
  await page.getByRole("button", { name: /^Layers/ }).click();
  await expect(page.getByText("Map layers")).toBeVisible();
  await expect(page.getByRole("button", { name: /wind plumes/i })).toBeVisible();
});

test("every section shows its spine: verb, blurb and numbered steps", async ({ page }) => {
  await page.goto("/console");
  const sidebar = page.getByRole("navigation", { name: "Console sections" }).first();
  for (const [label, verb, firstStep] of [
    ["Enforcement", "Act", "Morning brief"],
    ["Forecast", "Anticipate", "72-hour outlook"],
    ["Advisories", "Inform", "Advisories by ward"],
    ["Cities", "Compare", "Scoreboard"],
    ["Simulator", "Decide", "Choose an intervention"],
    ["Impact", "Fund", "The funding case"],
    ["Pipeline", "Trust", "Run the agents"],
  ] as const) {
    await sidebar.getByRole("button", { name: label, exact: true }).click();
    const spine = page.locator("[data-tour=spine]");
    await expect(spine.getByText(verb, { exact: true })).toBeVisible();
    await expect(spine.getByRole("button", { name: new RegExp(firstStep) })).toBeVisible();
  }
});

test("a cell story auto-opens with an explanation (never an empty box)", async ({ page }) => {
  await page.goto("/console");
  // H8: the best cell opens on load; C1: it always carries a "Why" section.
  await expect(page.getByText("Cell story", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Why —/).first()).toBeVisible();
});

test("enforcement worklist renders and a dossier opens", async ({ page }) => {
  await page.goto("/console");
  await expect(page.getByText("Enforcement Worklist")).toBeVisible();
  const dossier = page.getByRole("button", { name: /evidence dossier/i }).first();
  await expect(dossier).toBeVisible({ timeout: 15_000 });
  await dossier.click();
  // live dossiers run RAG + satellite-patch retrieval — give the backend room
  await expect(page.getByText(/Regulatory citations/i)).toBeVisible({ timeout: 25_000 });
});

test("simulator section shows the what-if engine", async ({ page }) => {
  await page.goto("/console");
  await page
    .getByRole("navigation", { name: "Console sections" })
    .first()
    .getByRole("button", { name: "Simulator" })
    .click();
  await expect(page.getByText("Choose an intervention").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /run simulation/i })).toBeVisible();
});
