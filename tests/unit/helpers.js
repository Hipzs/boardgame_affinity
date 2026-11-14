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

/** Tout le contexte de calcul construit sur la fixture (comme le font les pages). */
export async function loadWorld() {
  const { loadDataset } = await import("../../web/lib/dataset.js");
  const { buildAttrs } = await import("../../web/lib/attrs.js");
  const { buildGemQ } = await import("../../web/lib/gems.js");
  const { createNeighborIndex } = await import("../../web/lib/neighbors.js");
  const { createKeywordText } = await import("../../web/lib/keywords.js");
  const raw = loadFixture();
  const ds = loadDataset(raw);
  const at = buildAttrs(raw);
  const gemQ = buildGemQ(raw.nodes);
  const nb = createNeighborIndex({
    N: raw.nodes,
    ATTRS: at.ATTRS,
    ATTR_KEYS: at.ATTR_KEYS,
    franchise: at.franchise,
    gemQ,
  });
  const kwText = createKeywordText(raw);
  const ctx = { kwText: (g) => kwText(g), terms: (g, i, key) => at.ATTRS[key].set[i] };
  return { raw, ds, ...at, gemQ, nb, kwText, ctx };
}
export const OPTS = { gems: false, gemBeta: 2, noFranchise: false, noReimpl: false, noExpLine: false };
