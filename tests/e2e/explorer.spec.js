import { test, expect } from "@playwright/test";
import { useData, clearStorage, waitExplorer, IDS } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await useData(page);
  await page.goto("/index.html");
  await waitExplorer(page);
});

test("chargement par défaut : Terraforming Mars, signaux filtrés, pépites à 2,0", async ({ page }) => {
  await expect(page.locator("#search")).toHaveValue(/Terraforming Mars/);
  await expect(page.locator("#details h2")).toHaveText("Terraforming Mars");
  expect(await page.locator("#graph g.node").count()).toBeGreaterThan(1);
  await expect(page.locator("#sig-filter")).toBeChecked();
  await expect(page.locator(".sig-preset.on")).toHaveText("Convoité, gardé");
  await expect(page.locator("#gems-btn")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#gem-beta-out")).toHaveText("2,0");
  await expect(page.locator("#filter-count")).toHaveText("1"); // le filtre des signaux
});

test("recherche par mots-clés : « -dice » réduit le nombre de jeux qui passent", async ({ page }) => {
  const count = async () => +(await page.locator("#kd-msg").textContent()).match(/(\d+) \/ \d+ jeux passent/)[1];
  const before = await count();
  await page.fill("#f-kw", "-dice");
  await page.waitForFunction((b) => {
    const m = (document.querySelector("#kd-msg")?.textContent || "").match(/(\d+) \/ \d+ jeux passent/);
    return m && +m[1] < b;
  }, before);
  expect(await count()).toBeLessThan(before);
  await expect(page.locator("#filter-count")).toHaveText("2");
  await page.click("#reset"); // vide aussi le filtre des signaux : tous les jeux passent
  await page.waitForFunction(() =>
    /(\d+) \/ \1 jeux passent/.test(document.querySelector("#kd-msg")?.textContent || ""),
  );
  await expect(page.locator("#f-kw")).toHaveValue("");
  await expect(page.locator("#filter-count")).toHaveText("");
});

test("étiquette du jeu affiché ↔ filtre de gauche (mécanique, éditeur)", async ({ page }) => {
  const mech = page.locator('#details .chip.fchip[data-fk="m"]').first();
  const t = await mech.getAttribute("data-ft");
  await mech.click();
  await expect(page.locator(`#req-m .chip.on[data-t="${t}"]`)).toHaveCount(1);
  await expect(page.locator(`#details .chip.fchip[data-fk="m"][data-ft="${t}"]`)).toHaveClass(/f-on/);
  // retrait depuis la gauche : disparaît des deux côtés
  await page.locator(`#req-m .chip.on[data-t="${t}"]`).click();
  await expect(page.locator(`#req-m .chip.on`)).toHaveCount(0);
  await expect(page.locator(`#details .chip.fchip[data-fk="m"][data-ft="${t}"]`)).not.toHaveClass(/f-on/);

  const pub = page.locator('#details .chip.fchip[data-fk="pu"]').first();
  const name = (await pub.textContent()).trim();
  await pub.click();
  await expect(page.locator('.tagfilter[data-key="pu"] .chip.removable')).toHaveText(name);
  await expect(page.locator("#filter-count")).toHaveText("2");
  await page.locator('.tagfilter[data-key="pu"] .chip.removable').click();
  await expect(page.locator('.tagfilter[data-key="pu"] .chip.removable')).toHaveCount(0);
});

test("une étiquette est soit ✓ soit ✕ : la croix n'apparaît pas sur une étiquette sélectionnée", async ({ page }) => {
  const chip = page.locator("#req-m .chip.toggle").first();
  await chip.click();
  await expect(chip).toHaveClass(/\bon\b/);
  await expect(chip.locator(".ban-x")).toBeHidden();
  await chip.click(); // neutre
  await chip.hover();
  await chip.locator(".ban-x").click();
  await expect(chip).toHaveClass(/\bban\b/);
  await expect(chip).not.toHaveClass(/\bon\b/);
  await page.click("#req-clear");
  await expect(page.locator("#req-m .chip.ban")).toHaveCount(0);
});

test("le hash #id recentre sur le jeu", async ({ page }) => {
  await page.evaluate((id) => {
    location.hash = `#${id}`;
  }, IDS.pandemic);
  await expect(page.locator("#details h2")).toHaveText("Pandemic");
  await expect(page.locator("#search")).toHaveValue(/Pandemic/);
});

test("voisins ↔ profondeur : le budget pousse l'autre curseur", async ({ page }) => {
  await page.locator("#k").fill("14"); // k = 15
  await expect(page.locator("#k-out")).toHaveText("15");
  await page.locator("#depth").fill("3");
  await expect(page.locator("#depth-out")).toHaveText("3");
  await expect(page.locator("#k-out")).toHaveText("6"); // 15 voisins impossibles à profondeur 3
});
