// Aides communes aux tests Playwright.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..", "..");
export const REAL = process.env.E2E_REAL_DATA === "1";
export const hasRealData = existsSync(join(ROOT, "web", "data", "games.js"));
const fixturePath = join(ROOT, "tests", "fixtures", "games.small.js");

/** Identifiants BGG utilisés dans les tests (présents dans la fixture comme dans les vraies données). */
export const IDS = { terraformingMars: 167791, pandemic: 30549, catan: 13 };

/** Sert la fixture à la place de data/games.js, sauf si E2E_REAL_DATA=1. À appeler avant page.goto. */
export async function useData(page) {
  if (REAL) return;
  const body = readFileSync(fixturePath, "utf8");
  await page.route("**/data/games.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body }));
}

/** Pré-remplit le stockage des collections (clé bga.collections.v2) avant le chargement de la page. */
export async function seedCollections(page, data) {
  // addInitScript rejoue à chaque navigation (rechargement compris) : on ne pré-remplit qu'une fois par onglet.
  await page.addInitScript((d) => {
    if (window.sessionStorage.getItem("e2e-seeded")) return;
    window.sessionStorage.setItem("e2e-seeded", "1");
    window.localStorage.setItem("bga.collections.v2", JSON.stringify(d));
    window.localStorage.removeItem("bga.collections.ui.v1");
  }, data);
}

/** Vide tout le stockage avant le chargement (collections par défaut appliquées au premier chargement). */
export async function clearStorage(page) {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("e2e-seeded")) return;
    window.sessionStorage.setItem("e2e-seeded", "1");
    window.localStorage.clear();
  });
}

/** Attend que la simulation d3 du graphe soit immobile (positions des nodes stables pendant 400 ms). */
export async function waitGraphSettled(page) {
  await page.waitForFunction(
    () =>
      new Promise((ok) => {
        const snap = () =>
          [...document.querySelectorAll("#graph g.node")].map((n) => n.getAttribute("transform")).join("|");
        const a = snap();
        setTimeout(() => ok(a === snap()), 400);
      }),
    null,
    { timeout: 15_000, polling: 100 },
  );
}

/** Attend que l'explorateur ait rendu son graphe (ligne de compte sous Voisins / Profondeur). */
export async function waitExplorer(page) {
  await page.waitForFunction(() => /jeux affichés/.test(document.querySelector("#kd-msg")?.textContent || ""));
}

/** Lit le stockage des collections depuis la page. */
export const readStore = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("bga.collections.v2") || "null"));
