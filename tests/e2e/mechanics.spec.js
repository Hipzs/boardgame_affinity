import { test, expect } from "@playwright/test";
import { useData } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await useData(page);
  await page.goto("/mechanics.html");
  await expect(page.locator("#mh-svg rect[data-i]").first()).toBeVisible();
});

test("carte de chaleur : n² cases, groupes listés, changer de valeur et de nombre redessine", async ({ page }) => {
  const n = Number(await page.locator("#mh-n-out").textContent());
  expect(n).toBeGreaterThan(5);
  await expect(page.locator("#mh-svg rect[data-i]")).toHaveCount(n * n);
  await expect(page.locator("#mh-svg rect.mh-diag")).toHaveCount(n);
  expect(await page.locator("#mh-groups .mh-gbox").count()).toBeGreaterThan(1);
  await page.locator("#mh-metric").selectOption("count");
  await expect(page.locator("#mh-svg rect.mh-cnt").first()).toBeVisible();
  await page.locator("#mh-n").fill("12");
  await expect(page.locator("#mh-svg rect[data-i]")).toHaveCount(144);
});

test("survol : infobulle ; clic : jeux qui combinent les deux mécaniques", async ({ page }) => {
  await page.locator("#mh-min").fill("1");
  const cell = page.locator('#mh-svg rect[data-i="0"][data-j="1"]');
  await cell.hover();
  await expect(page.locator("#mh-tip")).toContainText("jeux en commun");
  await cell.click();
  await expect(page.locator("#mh-detail h2")).toContainText("+");
  await expect(page.locator("#mh-detail .mh-game a").first()).toHaveAttribute("href", /index\.html#\d+/);
});
