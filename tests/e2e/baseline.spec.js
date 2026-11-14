// Nombres de référence sur les VRAIES données : à générer avant un refactor (npm run baseline), à comparer après
// (npm run test:e2e:real). Sauté sans E2E_REAL_DATA=1 ou sans web/data/games.js.
import { test, expect } from "@playwright/test";
import { REAL, hasRealData, IDS, waitExplorer, clearStorage } from "./helpers.js";

test.skip(!REAL || !hasRealData, "baseline : vraies données requises (E2E_REAL_DATA=1 et web/data/games.js)");

const text = (page, sel) => page.locator(sel).evaluate((el) => el.textContent.trim());
const neighbours = (page) =>
  page
    .locator("#details .nb-list li")
    .evaluateAll((lis) => lis.map((li) => li.textContent.trim().replace(/\s+/g, " ")));

async function snapshot(page) {
  return {
    kd: await text(page, "#kd-msg"),
    filterCount: await text(page, "#filter-count"),
    sigCount: await text(page, "#sig-count"),
    weights: await text(page, "#weights"),
    details: await text(page, "#details h2"),
    neighbours: await neighbours(page),
  };
}

test("baseline explorateur (défauts, pépites off, métrique souple, Pandemic)", async ({ page }) => {
  await clearStorage(page);
  await page.goto("/index.html");
  await waitExplorer(page);
  const out = { defaults: await snapshot(page) };

  await page.click("#gems-btn"); // pépites off
  await waitExplorer(page);
  out.gemsOff = await snapshot(page);

  await page.selectOption("#metric", "soft");
  await page.waitForTimeout(300);
  out.soft = await snapshot(page);

  await page.selectOption("#metric", "cos");
  await page.evaluate((id) => {
    location.hash = `#${id}`;
  }, IDS.pandemic);
  await page.waitForFunction(() => /Pandemic/.test(document.querySelector("#details h2")?.textContent || ""));
  out.pandemic = await snapshot(page);

  expect(JSON.stringify(out, null, 1)).toMatchSnapshot("baseline.json");
});
