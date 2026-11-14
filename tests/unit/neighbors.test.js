import { test } from "node:test";
import assert from "node:assert/strict";
import { loadWorld, OPTS } from "./helpers.js";
import { K_MAX } from "../../web/lib/bfs.js";

const CFG = { metric: "cos", w: { m: 1, c: 0, f: 0, d: 0 } };

test("neighbors : top-K triés par similarité décroissante, sans le jeu lui-même", async () => {
  const { nb, raw } = await loadWorld();
  const u = raw.nodes.findIndex((g) => g.id === 167791);
  const pass = new Uint8Array(raw.nodes.length).fill(1);
  const top = nb.neighbors(u, CFG, OPTS, pass);
  assert.ok(top.length > 0 && top.length <= K_MAX);
  assert.ok(top.every(([v]) => v !== u));
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1][1] >= top[i][1]);
  assert.ok(top.every(([, s]) => s > 0 && s <= 1));
});
test("neighbors : le filtre `pass` exclut des candidats ; le cache est invalidé à la demande", async () => {
  const { nb, raw } = await loadWorld();
  const u = raw.nodes.findIndex((g) => g.id === 167791);
  const pass = new Uint8Array(raw.nodes.length).fill(1);
  const first = nb.neighbors(u, CFG, OPTS, pass);
  const banned = first[0][0];
  pass[banned] = 0;
  assert.equal(nb.neighbors(u, CFG, OPTS, pass), first, "résultat en cache tant qu'on n'invalide pas");
  nb.invalidate();
  assert.ok(nb.neighbors(u, CFG, OPTS, pass).every(([v]) => v !== banned));
});
test("neighbors : mode pépites = candidats s ≥ ρ·s_max, classés par s·q^β", async () => {
  const { nb, raw, gemQ } = await loadWorld();
  const u = raw.nodes.findIndex((g) => g.id === 167791);
  const pass = new Uint8Array(raw.nodes.length).fill(1);
  const gem = nb.neighbors(u, CFG, { ...OPTS, gems: true }, pass);
  for (let i = 1; i < gem.length; i++) assert.ok(gem[i - 1][2] >= gem[i][2]);
  for (const [v, s, score] of gem) assert.ok(Math.abs(score - s * gemQ[v] ** 2) < 1e-12);
});
test("neighbors : cosinus souple possible, options sans franchise / sans gamme d'extensions", async () => {
  const { nb, raw } = await loadWorld();
  const u = raw.nodes.findIndex((g) => g.id === 167791);
  const pass = new Uint8Array(raw.nodes.length).fill(1);
  const soft = nb.neighbors(u, { ...CFG, metric: "soft" }, OPTS, pass);
  assert.ok(soft.length > 0);
  nb.invalidate();
  const noxl = nb.neighbors(u, CFG, { ...OPTS, noExpLine: true }, pass);
  if (raw.nodes[u].xl >= 0) assert.ok(noxl.every(([v]) => raw.nodes[v].xl !== raw.nodes[u].xl));
});
