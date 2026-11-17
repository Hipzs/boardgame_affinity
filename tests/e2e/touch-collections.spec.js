import { test, expect } from "@playwright/test";
import { useData, seedCollections, readStore, IDS } from "./helpers.js";

/* Téléphone : appui long sur une fiche, glisser vers une pastille du tiroir (pages/collections/touch-dnd.js). */
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

const seed = {
  games: [IDS.terraformingMars, IDS.pandemic, IDS.catan].map((id) => ({ id, added: "2026-11-14T10:00:00.000Z" })),
  collections: [
    { cid: "c1", name: "Coopératifs", color: "#37b24d", created: "2026-11-14T10:00:00.000Z", games: [IDS.pandemic] },
    { cid: "c2", name: "Famille", color: "", created: "2026-11-14T10:00:00.000Z", games: [] },
  ],
};

test.beforeEach(async ({ page }) => {
  await seedCollections(page, seed);
  await useData(page);
  await page.goto("/collections.html");
  await page.locator(".swipe-tab", { hasText: "Nouveaux" }).click();
  // Défilement animé vers le panneau « Nouveaux » : attendre que la fiche soit en place (x stable, à l'écran).
  const card = page.locator(`#inbox .gcard[data-id="${IDS.catan}"]`);
  await expect.poll(async () => (await card.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
  await expect(card).toBeInViewport({ ratio: 1 });
  await page.waitForTimeout(300);
});

/** Rectangle d'un élément visible. @param {import("@playwright/test").Locator} l */
async function rect(l) {
  return /** @type {{x: number, y: number, width: number, height: number}} */ (await l.boundingBox());
}

/** Touches synthétiques (CDP) : start au centre de la fiche, attente, déplacements, fin. */
async function touch(page, cdp, type, x, y) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x, y }],
  });
}

test("appui long + glisser sur une pastille : le jeu est rangé", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const box = await rect(page.locator(`#inbox .gcard[data-id="${IDS.catan}"] .gname`));
  const x = box.x + 10,
    y = box.y + box.height / 2;
  await touch(page, cdp, "touchStart", x, y);
  await page.waitForTimeout(500);
  await expect(page.locator("#touch-tray")).toBeVisible();
  const chip = await rect(page.locator('#touch-tray .tray-chip[data-to="c1"]'));
  const cx = chip.x + chip.width / 2,
    cy = chip.y + chip.height / 2;
  for (let k = 1; k <= 5; k++) await touch(page, cdp, "touchMove", x + ((cx - x) * k) / 5, y + ((cy - y) * k) / 5);
  await expect(page.locator('#touch-tray .tray-chip[data-to="c1"]')).toHaveClass(/over/);
  await touch(page, cdp, "touchEnd", cx, cy);
  await expect(page.locator("#touch-tray")).toContainText("Catan → Coopératifs");
  const store = await readStore(page);
  expect(store.collections[0].games).toContain(IDS.catan);
});

test("appui long sans glisser : le tiroir reste ouvert, un tap range le jeu", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const box = await rect(page.locator(`#inbox .gcard[data-id="${IDS.catan}"] .gname`));
  await touch(page, cdp, "touchStart", box.x + 10, box.y + box.height / 2);
  await page.waitForTimeout(500);
  await touch(page, cdp, "touchEnd", box.x + 10, box.y + box.height / 2);
  await expect(page.locator("#touch-tray")).toBeVisible();
  await expect(page.locator("#gdetail h2")).toHaveCount(0); // pas d'ouverture du détail
  await page.locator('#touch-tray .tray-chip[data-to="c1"]').tap();
  await expect(page.locator("#touch-tray")).toContainText("Catan → Coopératifs");
  expect((await readStore(page)).collections[0].games).toContain(IDS.catan);
});

test("appui court : pas de tiroir (le tap garde son rôle)", async ({ page }) => {
  await page.locator(`#inbox .gcard[data-id="${IDS.catan}"] .gname`).tap();
  await expect(page.locator("#touch-tray")).toBeHidden();
});

// --- Jeu venant d'une collection : interrupteur Déplacer | Copier ---------------------------------------------------
async function liftPandemic(page) {
  await page.locator(".swipe-tab", { hasText: "Collections" }).click();
  const card = page.locator(`.coll-box .gcard[data-id="${IDS.pandemic}"]`);
  await expect.poll(async () => (await card.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(300);
  const cdp = await page.context().newCDPSession(page);
  const box = await rect(card.locator(".gname"));
  const x = box.x + 10,
    y = box.y + box.height / 2;
  await touch(page, cdp, "touchStart", x, y);
  await page.waitForTimeout(500);
  await expect(page.locator("#touch-tray")).toContainText("depuis Coopératifs");
  await page.waitForTimeout(250); // fin de l'animation du tiroir
  return { cdp, x, y };
}

test("collection → autre : Déplacer par défaut", async ({ page }) => {
  const { cdp, x, y } = await liftPandemic(page);
  await expect(page.locator('#touch-tray [data-mode="move"]')).toHaveAttribute("aria-pressed", "true");
  await touch(page, cdp, "touchEnd", x, y);
  await page.locator('#touch-tray .tray-chip[data-to="c2"]').tap();
  await expect(page.locator("#touch-tray")).toContainText("Pandemic déplacé vers Famille");
  const st = await readStore(page);
  expect(st.collections[0].games).not.toContain(IDS.pandemic);
  expect(st.collections[1].games).toContain(IDS.pandemic);
});

test("collection → autre : Copier au tap (« Nouveaux jeux » inactif)", async ({ page }) => {
  const { cdp, x, y } = await liftPandemic(page);
  await touch(page, cdp, "touchEnd", x, y);
  await page.locator('#touch-tray [data-mode="copy"]').tap();
  await expect(page.locator('#touch-tray [data-mode="copy"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#touch-tray .tray-chip.inbox")).toHaveCSS("pointer-events", "none");
  await page.locator('#touch-tray .tray-chip[data-to="c2"]').tap();
  await expect(page.locator("#touch-tray")).toContainText("Pandemic copié dans Famille");
  const st = await readStore(page);
  expect(st.collections[0].games).toContain(IDS.pandemic);
  expect(st.collections[1].games).toContain(IDS.pandemic);
});

test("collection → autre : Copier en glissant (passer sur « Copier » puis sur la pastille)", async ({ page }) => {
  const { cdp, x, y } = await liftPandemic(page);
  const m = await rect(page.locator('#touch-tray [data-mode="copy"]'));
  const c = await rect(page.locator('#touch-tray .tray-chip[data-to="c2"]'));
  const path = [
    [x, y],
    [m.x + m.width / 2, m.y + m.height / 2],
    [c.x + c.width / 2, c.y + c.height / 2],
  ];
  for (let k = 1; k < path.length; k++)
    for (let j = 1; j <= 4; j++) {
      const [ax, ay] = path[k - 1],
        [bx, by] = path[k];
      await touch(page, cdp, "touchMove", ax + ((bx - ax) * j) / 4, ay + ((by - ay) * j) / 4);
    }
  await expect(page.locator('#touch-tray [data-mode="copy"]')).toHaveAttribute("aria-pressed", "true");
  await touch(page, cdp, "touchEnd", c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.locator("#touch-tray")).toContainText("Pandemic copié dans Famille");
  const st = await readStore(page);
  expect(st.collections[0].games).toContain(IDS.pandemic);
  expect(st.collections[1].games).toContain(IDS.pandemic);
});
