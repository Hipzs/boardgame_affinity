// Empreinte du comportement de « Mes collections » (filtres, fiches, détails, étiquettes, tri, overlays) : garde-fou du
// découpage de collections.js. Collections par défaut du dépôt (11 jeux). Régénérer : --update-snapshots.
import { test, expect } from "@playwright/test";
import { useData, clearStorage, REAL } from "./helpers.js";

const clean = (t) => (t ?? "").replace(/\s+/g, " ").trim();
const txt = (page, sel) =>
  page
    .locator(sel)
    .evaluate((el) => el.textContent)
    .then(clean)
    .catch(() => "∅");
const all = (page, sel) =>
  page
    .locator(sel)
    .allTextContents()
    .then((a) => a.map(clean));

async function snap(page) {
  await page.waitForTimeout(450);
  return {
    counts: [
      await txt(page, "#coll-count"),
      await txt(page, "#inbox-count"),
      await txt(page, "#colls-count"),
      await txt(page, "#filter-count"),
      await txt(page, "#req-count"),
      await txt(page, "#f-stats"),
    ],
    inbox: await all(page, "#inbox .gcard"),
    colls: await all(page, "#colls .coll-box"),
    detail: await txt(page, "#gdetail"),
    req: [await txt(page, "#req-m"), await txt(page, "#req-c"), await txt(page, "#req-f")],
    tagChips: await all(page, ".tagfilter .chips .chip"),
    modes: await all(page, ".mode-tag"),
    rates: [await txt(page, "#av-out"), await txt(page, "#b-out")],
    msg: await txt(page, "#coll-msg"),
  };
}

test("empreinte Mes collections", async ({ page }) => {
  test.setTimeout(120000);
  await useData(page);
  await clearStorage(page);
  await page.goto("/collections.html");
  await expect(page.locator("#colls .coll-box")).toHaveCount(2);
  const out = {};
  out.defaults = await snap(page);

  await page.locator("#colls .gcard").first().click();
  out.selected = await snap(page);

  await page.locator("#gdetail [data-hk='m']").first().click(); // mécanique du jeu : filtre indispensable
  out.includeMech = await snap(page);
  await page.locator("#gdetail [data-hk='pu']").first().click(); // éditeur : champ Éditeur
  out.includePub = await snap(page);
  await page.locator("#gdetail [data-hk='c'] .ban-x").first().dispatchEvent("click"); // thème exclu
  out.excludeTheme = await snap(page);

  await page.locator(".mode-tag").first().click(); // ET <-> OU
  out.mode = await snap(page);
  const more = page.locator("#req-m .chip.more");
  if (await more.count()) await more.first().click();
  out.more = await snap(page);

  await page.fill("#pl-min", "2");
  await page.fill("#t-max", "120");
  out.numbers = await snap(page);
  await page.fill("#f-kw", "-dice");
  out.keyword = await snap(page);

  await page.hover("#filters-sum");
  await page.waitForTimeout(500);
  out.filterPop = await txt(page, "#filter-pop");
  await page.mouse.move(5, 5);

  await page.click("#reset");
  out.reset = await snap(page);
  await page.click("#req-clear");
  out.cleared = await snap(page);

  await page.check("#show-all");
  out.showAll = await snap(page);
  for (const v of await page
    .locator("#inbox-sort option")
    .evaluateAll((os) => os.map((o) => /** @type {HTMLOptionElement} */ (o).value))) {
    await page.selectOption("#inbox-sort", v);
    out[`sort-${v}`] = { inbox: await all(page, "#inbox .gcard") };
  }
  await page.uncheck("#show-all");

  // Collection à partir des filtres
  await page.fill("#f-kw", "mars");
  await page.waitForTimeout(400);
  await page.click("#f-save-btn");
  out.saveForm = { name: await page.inputValue("#f-save-name"), btn: await txt(page, "#f-save-btn") };
  await page.press("#f-save-name", "Enter");
  out.saved = await snap(page);

  // Overlay d'une collection (✎)
  await page.locator(".coll-box .cbtn[data-ren]").first().click();
  out.collPop = await txt(page, "#coll-pop");
  await page.keyboard.press("Escape");

  expect(JSON.stringify(out, null, 1)).toMatchSnapshot(
    REAL ? "fingerprint-collections-real.json" : "fingerprint-collections.json",
  );
});
