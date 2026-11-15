// @ts-nocheck
// Temporaire (étapes 2-3 du refactoring) : le calcul des voisins de web/lib/ doit être identique à celui de app.js.
import { test, expect } from "@playwright/test";
import { useData, waitExplorer } from "./helpers.js";

test("lib/neighbors.js = neighbors() de app.js (20 jeux × 4 métriques)", async ({ page }) => {
  await useData(page);
  await page.goto("/index.html");
  await waitExplorer(page);
  const res = await page.evaluate(async () => {
    const { buildAttrs } = await import("/lib/attrs.js");
    const { buildGemQ } = await import("/lib/gems.js");
    const { createNeighborIndex } = await import("/lib/neighbors.js");
    const D = window.BGG_DATA;
    const at = buildAttrs(D);
    const nb = createNeighborIndex({
      N: D.nodes,
      ATTRS: at.ATTRS,
      ATTR_KEYS: at.ATTR_KEYS,
      franchise: at.franchise,
      gemQ: buildGemQ(D.nodes),
    });
    const dbg = window.__dbg;
    const pass = dbg.getPass();
    const opts = { gems: false, gemBeta: 2, noFranchise: false, noReimpl: false, noExpLine: false };
    const w = { m: 0.4, c: 0.3, f: 0.2, d: 0.1 };
    const out = [];
    for (let u = 0; u < Math.min(20, D.nodes.length); u++) {
      for (const metric of ["cos", "jac", "ovl", "soft"]) {
        const cfg = { metric, w };
        const a = JSON.stringify(dbg.neighbors(u, cfg));
        const b = JSON.stringify(nb.neighbors(u, cfg, opts, pass));
        if (a !== b) out.push({ u, metric });
      }
    }
    return out;
  });
  expect(res).toEqual([]);
});
