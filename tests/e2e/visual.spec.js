// Garde-fou visuel du découpage CSS : captures des deux pages à deux largeurs (fixture, collections pré-remplies).
// Le graphe d3 (positions non déterministes) est masqué.
import { test, expect } from "@playwright/test";
import { useData, seedCollections, waitExplorer, IDS } from "./helpers.js";

const seed = {
  games: [IDS.terraformingMars, IDS.pandemic, IDS.catan].map((id) => ({ id, added: "2026-11-14T10:00:00.000Z" })),
  collections: [
    { cid: "c1", name: "Coopératifs", color: "#37b24d", created: "2026-11-14T10:00:00.000Z", games: [IDS.pandemic] },
    { cid: "c2", name: "Familiaux", color: "", created: "2026-11-14T10:00:00.000Z", games: [IDS.catan] },
  ],
};

for (const width of [1440, 800]) {
  test(`explorateur @ ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedCollections(page, seed);
    await useData(page);
    await page.goto("/index.html");
    await waitExplorer(page);
    await expect(page.locator("#details h2")).toHaveText("Terraforming Mars"); // détails du jeu central affichés
    await expect(page).toHaveScreenshot(`explorer-${width}.png`, { fullPage: true, mask: [page.locator("#stage")] });
  });

  test(`mes collections @ ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedCollections(page, seed);
    await useData(page);
    await page.goto("/collections.html");
    await page.locator(`#inbox .gcard[data-id="${IDS.terraformingMars}"]`).click();
    await expect(page.locator("#gdetail h2")).toContainText("Terraforming Mars");
    await expect(page).toHaveScreenshot(`collections-${width}.png`, { fullPage: true });
  });
}
