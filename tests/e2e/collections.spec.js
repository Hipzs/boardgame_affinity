import { test, expect } from "@playwright/test";
import { useData, seedCollections, readStore, IDS } from "./helpers.js";

const seed = {
  games: [IDS.terraformingMars, IDS.pandemic, IDS.catan].map((id) => ({ id, added: "2026-11-14T10:00:00.000Z" })),
  collections: [
    { cid: "c1", name: "Coopératifs", color: "#37b24d", created: "2026-11-14T10:00:00.000Z", games: [IDS.pandemic] },
  ],
};

test.beforeEach(async ({ page }) => {
  await seedCollections(page, seed);
  await useData(page);
  await page.goto("/collections.html");
  await expect(page.locator("#inbox .gcard")).toHaveCount(2);
});

test("affichage : nouveaux jeux, collection, compteurs", async ({ page }) => {
  await expect(page.locator("#coll-count")).toHaveText("3");
  await expect(page.locator("#inbox-count")).toHaveText("2");
  await expect(page.locator(".coll-box .cname")).toHaveText("Coopératifs");
  await expect(page.locator(".coll-box .gcard")).toHaveCount(1);
  await expect(page.locator("#gdetail")).toContainText("Clique sur un jeu");
});

test("glisser un nouveau jeu dans une collection", async ({ page }) => {
  const card = page.locator(`#inbox .gcard[data-id="${IDS.catan}"]`);
  await card.dragTo(page.locator(".coll-box.dropzone"));
  await expect(page.locator(".coll-box .gcard")).toHaveCount(2);
  const store = await readStore(page);
  expect(store.collections[0].games).toContain(IDS.catan);
  await expect(page.locator("#coll-msg")).toContainText("Catan → Coopératifs");
});

test("clic sur un jeu : détails à droite ; étiquette du détail ↔ filtre de gauche", async ({ page }) => {
  await page.locator(`#inbox .gcard[data-id="${IDS.terraformingMars}"]`).click();
  await expect(page.locator("#gdetail h2")).toContainText("Terraforming Mars");
  const chip = page.locator('#gdetail .chip[data-hk="m"]').first();
  const t = await chip.getAttribute("data-ht");
  await chip.click();
  await expect(chip).toHaveClass(/\bon\b/);
  await expect(page.locator(`#req-m .chip.on[data-t="${t}"]`)).toHaveCount(1);
  await expect(page.locator("#f-save-btn")).toBeVisible();
  // retrait depuis la gauche
  await page.locator(`#req-m .chip.on[data-t="${t}"]`).click();
  await expect(chip).not.toHaveClass(/\bon\b/);
  await expect(page.locator("#f-save")).toBeHidden();
});

test("nouvelle collection à partir des filtres", async ({ page }) => {
  await page.fill("#f-kw", "mars");
  await expect(page.locator("#f-stats")).toContainText("1 / 3");
  await page.click("#f-save-btn");
  await expect(page.locator("#f-save-name")).toHaveValue(/mars/);
  await page.fill("#f-save-name", "Planètes");
  await page.locator("#f-save-form button[type=submit]").click();
  await expect(page.locator(".coll-box .cname")).toHaveText(["Coopératifs", "Planètes"]);
  const store = await readStore(page);
  expect(store.collections[1].games).toEqual([IDS.terraformingMars]);
});

test("renommer et colorer une collection via l'overlay ✎", async ({ page }) => {
  await page.locator(".coll-box [data-ren]").click();
  await expect(page.locator("#coll-pop")).toBeVisible();
  await page.fill("#pop-name", "Coop du soir");
  await page.locator('#coll-pop .sw[data-c="#1c7ed6"]').click();
  await page.locator('#coll-pop [data-a="ok"]').click();
  await expect(page.locator(".coll-box .cname")).toHaveText("Coop du soir");
  const store = await readStore(page);
  expect(store.collections[0]).toMatchObject({ name: "Coop du soir", color: "#1c7ed6" });
});

test("l'état des filtres et le jeu affiché survivent à un rechargement", async ({ page }) => {
  await page.locator(`#inbox .gcard[data-id="${IDS.catan}"]`).click();
  await page.fill("#f-kw", "a");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator("#gdetail h2")).toContainText("Catan");
  await expect(page.locator("#f-kw")).toHaveValue("a");
});

test("curseur de note : glisser la bande déplace l'intervalle en gardant sa largeur", async ({ page }) => {
  await useData(page);
  await page.goto("/collections.html");
  await expect(page.locator("#av-lo")).toHaveAttribute("min", "20"); // le script de la page a câblé les curseurs
  await page.evaluate(() => {
    const set = (id, v) => {
      const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("av-lo", 40);
    set("av-hi", 60);
  });
  const box = page.locator("#av-int");
  await expect(page.locator("#av-out")).toHaveText("4.0 → 6.0");
  await box.scrollIntoViewIfNeeded();
  const r = /** @type {{x: number, y: number, width: number, height: number}} */ (await box.boundingBox());
  const x = r.x + r.width * ((5 - 2) / (9 - 2)); // milieu de la bande (note 5 sur 2–9)
  const y = r.y + r.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + r.width * 0.2, y, { steps: 5 });
  await page.mouse.up();
  const out = /** @type {string} */ (await page.locator("#av-out").textContent());
  const [lo, hi] = out.split("→").map((t) => parseFloat(t));
  expect(+(hi - lo).toFixed(1)).toBe(2);
  expect(lo).toBeGreaterThan(4.5);
});
