import { test, expect } from "@playwright/test";
import { useData, clearStorage, waitExplorer, IDS } from "./helpers.js";

test("lien partagé : la vue (jeu, k, métrique, liens croisés, filtres, vue) se retrouve dans un autre onglet", async ({
  page,
  context,
}) => {
  await clearStorage(page);
  await useData(page);
  await page.goto("/index.html");
  await waitExplorer(page);
  await page.locator("#search").fill("Pandemic");
  await page.click("#go");
  await expect(page.locator("#details h2")).toHaveText("Pandemic");
  await page.locator("#k").fill("7"); // k = 8
  await page.locator("#metric").selectOption("soft");
  await page.click("#cross");
  await page.fill("#f-kw", "-dice");
  await page.click("#show-rating");
  await page.waitForFunction(() => /jeux passent/.test(document.querySelector("#kd-msg")?.textContent || ""));
  await page.click("#share-btn");
  await expect(page.locator("#search-msg")).toContainText("Lien");
  const url = await page.evaluate(async () => {
    let u = location.href;
    try {
      u = await navigator.clipboard.readText();
    } catch {
      /* repli : adresse du navigateur */
    }
    return u.includes("~") ? u : location.href;
  });
  expect(url).toMatch(new RegExp(`#${IDS.pandemic}~`));

  const other = await context.newPage();
  await useData(other);
  await other.goto(url);
  await waitExplorer(other);
  await expect(other.locator("#details h2")).toHaveText("Pandemic");
  await expect(other.locator("#k-out")).toHaveText("8");
  await expect(other.locator("#metric")).toHaveValue("soft");
  await expect(other.locator("#cross")).toHaveAttribute("aria-pressed", "true");
  await expect(other.locator("#show-rating")).toHaveAttribute("aria-pressed", "true");
  await expect(other.locator("#f-kw")).toHaveValue("-dice");
  await expect(other.locator("#filter-count")).toHaveText("2");
  await expect(other.locator("#kd-msg")).toContainText("jeux passent");
});

test("#id seul : comportement inchangé (recentre sur le jeu, réglages par défaut)", async ({ page }) => {
  await clearStorage(page);
  await useData(page);
  await page.goto(`/index.html#${IDS.catan}`);
  await waitExplorer(page);
  await expect(page.locator("#details h2")).toHaveText("Catan");
  await expect(page.locator("#k-out")).toHaveText("5");
});
