import { test } from "node:test";
import assert from "node:assert/strict";
import { agreementConfigs, consensus, overlap } from "../../web/lib/agreement.js";
import { loadWorld, OPTS } from "./helpers.js";

test("accord : 4 métriques + 4 attributs ; consensus ≥ moitié ; overlap", async () => {
  const w = await loadWorld();
  const u = w.raw.nodes.findIndex((g) => g.id === 167791);
  const pass = new Uint8Array(w.raw.nodes.length).fill(1);
  const base = { metric: "cos", w: { m: 0.5, c: 0.5, f: 0, d: 0 } };
  const { mConfs, aConfs } = agreementConfigs({
    ATTRS: w.ATTRS,
    ATTR_KEYS: w.ATTR_KEYS,
    base,
    top: (cfg) =>
      w.nb
        .neighbors(u, cfg, OPTS, pass)
        .slice(0, 5)
        .map((x) => x[0]),
  });
  assert.equal(mConfs.length, 4);
  assert.equal(aConfs.length, 4);
  const { all, half, cons } = consensus(mConfs, aConfs);
  assert.equal(all.length, 8);
  assert.equal(half, 4);
  assert.ok(cons.every(([, c]) => c.n >= half));
  assert.equal(overlap([1, 2, 3], [2, 3, 4], 3), 2 / 3);
  assert.equal(overlap([], [], 0), 0);
});
