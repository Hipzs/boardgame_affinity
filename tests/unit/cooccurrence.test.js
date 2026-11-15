import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCooccurrence, lift, npmi, topTags, cluster } from "../../web/lib/cooccurrence.js";

// 4 étiquettes : 0 et 1 toujours ensemble, 2 et 3 toujours ensemble, jamais entre paires.
const nodes = [...Array(10).fill({ m: [0, 1] }), ...Array(10).fill({ m: [2, 3] }), ...Array(5).fill({ m: [0] })];

test("comptes, lift et NPMI : étiquettes soudées, indépendantes, exclusives", () => {
  const co = buildCooccurrence(nodes, 4);
  assert.deepEqual([...co.count], [15, 10, 10, 10]);
  assert.equal(co.pair(1, 0), 10);
  assert.equal(co.pair(0, 2), 0);
  assert.ok(Math.abs(lift(co, 0, 1) - (10 * 25) / (15 * 10)) < 1e-12);
  assert.equal(lift(co, 0, 2), 0);
  assert.equal(npmi(co, 0, 2), -1);
  assert.equal(npmi(co, 2, 2), 1);
  assert.ok(Math.abs(npmi(co, 2, 3) - 1) < 1e-12); // toujours ensemble : NPMI = 1
  const indep = buildCooccurrence([{ m: [0, 1] }, { m: [0] }, { m: [1] }, { m: [] }], 2);
  assert.ok(Math.abs(npmi(indep, 0, 1)) < 1e-12); // P(a,b) = P(a)P(b)
  assert.ok(Math.abs(lift(indep, 0, 1) - 1) < 1e-12);
});
test("topTags : plus fréquentes d'abord, seuil minimal", () => {
  const co = buildCooccurrence(nodes, 4);
  assert.deepEqual(topTags(co.count, 3), [0, 1, 2]);
  assert.deepEqual(topTags(co.count, 10, 11), [0]);
});
test("cluster : les paires soudées sont voisines dans l'ordre ; cut(2) les sépare", () => {
  const co = buildCooccurrence(nodes, 4);
  const { order, cut } = cluster(4, (i, j) => 1 - npmi(co, i, j));
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  const pos = (t) => order.indexOf(t);
  assert.equal(Math.abs(pos(0) - pos(1)), 1);
  assert.equal(Math.abs(pos(2) - pos(3)), 1);
  const g = cut(2);
  assert.equal(g[0], g[1]);
  assert.equal(g[2], g[3]);
  assert.notEqual(g[0], g[2]);
  assert.deepEqual(cut(1), [0, 0, 0, 0]);
  assert.equal(new Set(cut(4)).size, 4);
  assert.deepEqual(cluster(0, () => 0).order, []);
  assert.deepEqual(cluster(1, () => 0).order, [0]);
});
