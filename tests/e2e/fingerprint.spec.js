// Empreinte du comportement de l'explorateur (graphe, carte, thèmes, détails, accord, overlays) : sert à prouver qu'un
// refactor ne change rien de visible. Données de la fixture ; les positions (non déterministes) ne sont pas relevées.
// Régénérer volontairement : npx playwright test tests/e2e/fingerprint.spec.js --update-snapshots
import { test, expect } from "@playwright/test";
import { useData, clearStorage, waitExplorer, REAL } from "./helpers.js";

const clean = (t) => (t ?? "").replace(/\s+/g, " ").trim();
const txt = (page, sel) =>
  page
    .locator(sel)
    .evaluate((el) => el.textContent)
    .then(clean)
    .catch(() => "∅");
const count = (page, sel) => page.locator(sel).count();

async function snap(page) {
  await page.waitForTimeout(350);
  return {
    kd: await txt(page, "#kd-msg"),
    search: await txt(page, "#search-msg"),
    filters: [await txt(page, "#filter-count"), await txt(page, "#req-count"), await txt(page, "#sig-count")],
    weights: await txt(page, "#weights"),
    graph: {
      nodes: await count(page, "#graph g.node"),
      links: await count(page, "#graph line"),
      labels: await page
        .locator("#graph g.node text")
        .allTextContents()
        .then((a) => a.map(clean).sort()),
    },
    map: {
      points: await count(page, "#map circle"),
      msg: await txt(page, "#map-msg"),
      buttons: await page
        .locator("#map-alpha-row button")
        .allTextContents()
        .then((a) => a.map(clean)),
    },
    details: await txt(page, "#details"),
    agree: await txt(page, "#agree"),
    legend: [await txt(page, "#legend-depth"), await txt(page, "#legend-signals"), await txt(page, "#emoji-legend")],
  };
}

test("empreinte explorateur", async ({ page }) => {
  test.setTimeout(120000);
  await useData(page);
  await clearStorage(page);
  await page.goto("/index.html");
  await waitExplorer(page);
  const out = {};
  out.defaults = await snap(page);

  await page.click("#cross");
  out.cross = await snap(page);
  await page.click("#cross");

  await page.click("#emoji");
  out.emoji = await snap(page);
  await page.click("#show-rating");
  await page.click("#color-rating");
  out.rating = await snap(page);
  await page.click("#show-rating");
  await page.click("#color-rating");
  await page.click("#emoji");

  await page.selectOption("#metric", "jac");
  out.jaccard = await snap(page);
  await page.selectOption("#metric", "cos");

  await page.click("#weights .wchip[data-k='c']"); // thème seul
  out.themeOnly = await snap(page);
  await page.click("#weights .wchip[data-k='m']");

  await page.evaluate(() => {
    const k = /** @type {HTMLInputElement} */ (document.getElementById("depth"));
    k.value = "1";
    k.dispatchEvent(new Event("input", { bubbles: true }));
  });
  out.depth1 = await snap(page);

  // Carte : une vue par attribut, thèmes (moyenne puis pic)
  await page.click("#map-btn");
  out.map = await snap(page);
  const alphas = page.locator("#map-alpha-row button");
  for (let i = 0; i < (await alphas.count()); i++) {
    await alphas.nth(i).click();
    out[`mapSel${i}`] = await snap(page);
  }
  await page.click("#fam-btn");
  out.themes = await snap(page);
  await page.click("#fam-center");
  out.themesPeak = await snap(page);
  await page.click("#fam-btn");
  await page.click("#view-switch [data-view='graph']");

  // Recentrage par saisie et détails d'un voisin
  await page.fill("#search", "Pandemic");
  await page.click("#go");
  await waitExplorer(page);
  out.pandemic = await snap(page);
  await page.locator("#graph g.node:not(.d0)").first().dispatchEvent("click");
  out.neighbourDetails = await snap(page);

  // Overlays : filtres actifs (survol), export
  await page.hover("#filters-sum");
  await page.waitForTimeout(500);
  out.filterPop = await txt(page, "#filter-pop");
  await page.mouse.move(5, 5);
  await page.click("#export-btn");
  out.exportPop = await txt(page, "#export-pop");
  await page.keyboard.press("Escape");

  expect(JSON.stringify(out, null, 1)).toMatchSnapshot(REAL ? "fingerprint-real.json" : "fingerprint.json");
});
