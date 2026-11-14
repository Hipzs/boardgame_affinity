import { test } from "node:test";
import assert from "node:assert/strict";
import { attrPair, attrWeights, cfgKey, pairDetail, METRIC_KEYS } from "../../web/lib/metrics.js";
import { loadWorld } from "./helpers.js";

test("attrWeights : normalisés, somme 1 ; tout à 0 → pas de division par 0", () => {
  const keys = ["m", "c", "f", "d"];
  const w = attrWeights(keys, { m: 50, c: 50, f: 0, d: 0 });
  assert.deepEqual(w, { m: 0.5, c: 0.5, f: 0, d: 0 });
  assert.ok(Object.values(attrWeights(keys, { m: 0, c: 0, f: 0, d: 0 })).every((x) => x === 0));
  assert.equal(cfgKey(keys, { metric: "cos", w }), "cos|0.500,0.500,0.000,0.000");
});

test("attrPair : un jeu avec lui-même vaut 1 (cos, jac, ovl, soft) quand il a des étiquettes", async () => {
  const { ATTRS, raw } = await loadWorld();
  const u = raw.nodes.findIndex((g) => g.id === 167791);
  for (const metric of METRIC_KEYS)
    for (const key of ["m", "c"]) {
      assert.ok(Math.abs(attrPair(ATTRS, key, metric, u, u) - 1) < 1e-9, `${metric}/${key}`);
    }
});
test("attrPair : symétrique pour cos/jac/ovl, dans [0, 1]", async () => {
  const { ATTRS, raw } = await loadWorld();
  for (const metric of ["cos", "jac", "ovl"])
    for (let u = 0; u < 6; u++)
      for (let v = 0; v < 6; v++) {
        const a = attrPair(ATTRS, "m", metric, u, v),
          b = attrPair(ATTRS, "m", metric, v, u);
        assert.ok(Math.abs(a - b) < 1e-9);
        assert.ok(a >= -1e-12 && a <= 1 + 1e-9);
      }
  assert.ok(raw.nodes.length > 6);
});
test("pairDetail : somme pondérée des parties", async () => {
  const { ATTRS, ATTR_KEYS } = await loadWorld();
  const cfg = { metric: "cos", w: { m: 0.7, c: 0.3, f: 0, d: 0 } };
  const { s, parts } = pairDetail(ATTRS, ATTR_KEYS, 0, 1, cfg);
  assert.deepEqual(Object.keys(parts), ["m", "c"]);
  assert.ok(Math.abs(s - (0.7 * parts.m + 0.3 * parts.c)) < 1e-12);
});
