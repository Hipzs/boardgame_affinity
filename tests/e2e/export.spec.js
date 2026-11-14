import { test, expect } from "@playwright/test";
import { useData, clearStorage, waitExplorer, waitGraphSettled, readStore } from "./helpers.js";

test("Exporter ⇪ : le graphe entier vers une nouvelle collection, visible dans l'autre onglet", async ({
  page,
  context,
}) => {
  await clearStorage(page);
  await useData(page);
  await page.goto("/index.html");
  await waitExplorer(page);
  const nodes = await page.locator("#graph g.node").count();

  await page.click("#export-btn");
  await expect(page.locator("#export-pop .xp-head")).toContainText(`${nodes} jeux dans le graphe`);
  await page.locator("#export-pop .xp-new input").fill("Autour de Mars");
  await page.locator("#export-pop .xp-new button").click();
  await expect(page.locator("#export-pop")).toBeHidden();
  await expect(page.locator("#search-msg")).toContainText("Autour de Mars");

  const store = await readStore(page);
  const coll = store.collections.find((c) => c.name === "Autour de Mars");
  expect(coll.games).toHaveLength(nodes);

  const other = await context.newPage();
  await useData(other);
  await other.goto("/collections.html");
  await expect(other.locator(".coll-box", { hasText: "Autour de Mars" }).locator(".gcard")).toHaveCount(nodes);
});

test("Choisir dans le graphe : seuls les nodes sélectionnés sont exportés", async ({ page }) => {
  await clearStorage(page);
  await useData(page);
  await page.goto("/index.html");
  await waitExplorer(page);
  const nodes = await page.locator("#graph g.node").count();

  await page.click("#export-btn");
  await page.locator("#export-pop .xp-pick").click();
  await expect(page.locator("#pick-bar")).toBeVisible();
  await expect(page.locator("#graph g.node.pick-on")).toHaveCount(nodes);
  // désélectionne deux nodes non centraux (une fois la simulation immobile)
  await waitGraphSettled(page);
  // dispatchEvent : un clic souris réel ne se stabilise jamais pour Playwright sur un node animé par d3
  const others = page.locator("#graph g.node:not(.d0)");
  await others.nth(0).dispatchEvent("click");
  await others.nth(1).dispatchEvent("click");
  await expect(page.locator("#pick-bar b")).toHaveText(String(nodes - 2));

  await page.locator('#pick-bar [data-p="export"]').click();
  await expect(page.locator("#export-pop .xp-head")).toContainText(
    new RegExp(`${nodes - 2} jeux? sélectionnés? sur ${nodes}`),
  );
  const before = (await readStore(page)).games.map((g) => g.id); // collections par défaut déjà présentes
  await page.locator('#export-pop .xp-opt[data-to=""]').click(); // vers Nouveaux jeux
  await expect(page.locator("#pick-bar")).toBeHidden();
  await expect(page.locator("#search-msg")).toContainText(
    new RegExp(`${nodes - 2} jeux? exportés? vers Nouveaux jeux`),
  );
  const after = (await readStore(page)).games.map((g) => g.id);
  expect(after.length).toBeGreaterThanOrEqual(before.length);
  expect(after.length - before.length).toBeLessThanOrEqual(nodes - 2);
});
