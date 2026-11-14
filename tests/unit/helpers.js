// Aides communes aux tests unitaires (node:test).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..", "..");

/** Données de la fixture (format de web/data/games.js), rechargées à chaque appel : chaque test part d'une copie neuve. */
export function loadFixture() {
  return JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", "games.small.json"), "utf8"));
}

/** Fausse localStorage (API Storage minimale) pour tester le store des collections sans navigateur. */
export function fakeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    removeItem: (k) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    dump: () => Object.fromEntries(m),
  };
}
