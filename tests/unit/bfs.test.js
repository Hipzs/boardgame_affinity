import { test } from "node:test";
import assert from "node:assert/strict";
import { worst, maxDepth, maxK, expand, BUDGET, MAX_NODES } from "../../web/lib/bfs.js";

test("budget : worst, maxDepth, maxK", () => {
  assert.equal(worst(5, 2), 30);
  assert.equal(worst(15, 2), 240);
  assert.equal(worst(6, 3), 258);
  assert.equal(maxDepth(15), 2);
  assert.equal(maxDepth(1), 6);
  assert.equal(maxK(3), 6);
  assert.ok(worst(maxK(3) ?? 0, 3) <= BUDGET && worst((maxK(3) ?? 0) + 1, 3) > BUDGET);
});

// Graphe jouet : voisins de u = u+1, u+2, u+3 (similarité décroissante)
const toy = (u) => [1, 2, 3].map((d, r) => [u + d, 0.9 - 0.2 * r]);

test("expand : niveaux, parents, liens d'arbre", () => {
  const r = expand({ center: 0, k: 2, depth: 2, cross: false, tau: 0 }, toy);
  assert.deepEqual(
    [...r.level].sort((a, b) => a[0] - b[0]),
    [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
    ],
  );
  assert.deepEqual(r.parent.get(3), [1, 0.7]);
  assert.equal(r.links.length, 4);
  assert.ok(r.links.every((l) => !l.cross));
  assert.equal(r.truncated, false);
});
test("expand : le seuil τ élague et compte", () => {
  const r = expand({ center: 0, k: 3, depth: 1, cross: false, tau: 0.6 }, toy);
  assert.deepEqual([...r.level.keys()], [0, 1, 2]); // 0,9 et 0,7 gardés ; 0,5 coupé
  assert.equal(r.pruned, 1);
});
test("expand : liens croisés entre nœuds déjà présents, sans doublon", () => {
  const r = expand({ center: 0, k: 2, depth: 2, cross: true, tau: 0 }, toy);
  const cross = r.links.filter((l) => l.cross);
  assert.ok(cross.length > 0);
  const keys = r.links.map((l) => [l.source, l.target].sort((a, b) => a - b).join("-"));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(cross.every((l) => r.level.has(l.source) && r.level.has(l.target)));
});
test("expand : troncature au budget", () => {
  const wide = (u) => Array.from({ length: 15 }, (_, j) => [u * 15 + j + 1, 0.9]);
  const r = expand({ center: 0, k: 15, depth: 4, cross: false, tau: 0 }, wide);
  assert.ok(r.truncated);
  assert.equal(r.level.size, MAX_NODES);
});
