import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFilterState,
  passes,
  computePass,
  filterCount,
  reqBanCount,
  resetFilters,
  clearReqBan,
  setKeywords,
  includeTag,
  excludeTag,
  addTag,
  isIncluded,
  isExcluded,
  rateActive,
} from "../../web/lib/filters.js";
import { loadWorld } from "./helpers.js";

const G = (over = {}) => ({
  id: 1,
  n: "Jeu",
  m: [1, 2],
  c: [3],
  f: [4],
  d: [5],
  ar: [6],
  pu: [7],
  av: 7,
  b: 6.5,
  p: [2, 4],
  t: 60,
  a: 10,
  w: null,
  ...over,
});
const ctxOf = (extra = {}) => ({
  kwText: () => "terraforming mars | dice",
  terms: (g, i, key) => new Set(g[{ m: "m", c: "c", f: "f", d: "d" }[key]]),
  ...extra,
});
const F0 = () => createFilterState();

test("sans filtre : tout passe ; poids null sans filtre de poids", () => {
  assert.ok(passes(G(), 0, F0(), ctxOf()));
});
test("joueurs : intersection d'intervalles ; jeu sans nombre de joueurs refusé", () => {
  const F = F0();
  F.nums.plMin = 5;
  assert.ok(!passes(G(), 0, F, ctxOf())); // 2–4 joueurs
  F.nums.plMin = 3;
  assert.ok(passes(G(), 0, F, ctxOf()));
  F.nums.plMax = 1;
  assert.ok(!passes(G(), 0, F, ctxOf()));
  F.nums.plMax = null;
  F.nums.plMin = 1;
  assert.ok(!passes(G({ p: [0, 0] }), 0, F, ctxOf()));
});
test("durée, âge max, poids", () => {
  const F = F0();
  F.nums.tMin = 90;
  assert.ok(!passes(G(), 0, F, ctxOf()));
  F.nums.tMin = null;
  F.nums.ageMax = 8;
  assert.ok(!passes(G(), 0, F, ctxOf()));
  F.nums.ageMax = null;
  F.nums.wMin = 2;
  assert.ok(!passes(G({ w: null }), 0, F, ctxOf()), "poids inconnu refusé quand un filtre de poids est actif");
  assert.ok(passes(G({ w: 3 }), 0, F, ctxOf()));
});
test("notes : actives seulement si l'intervalle ne couvre pas toute la plage", () => {
  const F = F0();
  assert.ok(!rateActive(F, "av"));
  F.rate.av.lo = 7.5;
  assert.ok(rateActive(F, "av") && !passes(G(), 0, F, ctxOf()));
  F.rate.av.lo = 6.5;
  assert.ok(passes(G(), 0, F, ctxOf()));
});
test("mots-clés", () => {
  const F = F0();
  setKeywords(F, "Mars");
  assert.ok(passes(G(), 0, F, ctxOf()));
  setKeywords(F, "mars -dice");
  assert.ok(!passes(G(), 0, F, ctxOf()));
});
test("Garder / exclure : ET, OU, interdites", () => {
  const F = F0();
  F.req.m.add(1);
  F.req.m.add(9);
  assert.ok(!passes(G(), 0, F, ctxOf()), "ET : 9 manque");
  F.modeReq.m = "or";
  assert.ok(passes(G(), 0, F, ctxOf()), "OU : 1 suffit");
  F.ban.c.add(3);
  assert.ok(!passes(G(), 0, F, ctxOf()), "interdite présente");
  assert.equal(reqBanCount(F), 3);
  clearReqBan(F);
  assert.equal(reqBanCount(F), 0);
});
test("étiquettes (famille, auteur…) : OU par défaut, ET au choix ; exclusions", () => {
  const F = F0();
  F.tags.ar.add(6);
  F.tags.ar.add(66);
  assert.ok(passes(G(), 0, F, ctxOf()));
  F.modeTag.ar = "and";
  assert.ok(!passes(G(), 0, F, ctxOf()));
  const F2 = F0();
  F2.notTags.pu.add(7);
  assert.ok(!passes(G(), 0, F2, ctxOf()));
});
test("signaux : filtrent seulement si sigFilter et contexte fournis", () => {
  const F = createFilterState({ sigFilter: true });
  const signals = { active: (k) => k === "wish", inInt: () => false };
  assert.ok(!passes(G(), 0, F, ctxOf({ signals })));
  assert.ok(passes(G(), 0, F, ctxOf({ signals: null })));
  F.sigFilter = false;
  assert.ok(passes(G(), 0, F, ctxOf({ signals })));
});
test("filterCount : deux modes (Garder / exclure compté ou non)", () => {
  const F = F0();
  F.req.m.add(1);
  F.noReimpl = true;
  F.nums.tMin = 30;
  assert.equal(filterCount(F), 2);
  assert.equal(filterCount(F, { reqInCount: true }), 3);
  F.sigFilter = true;
  assert.equal(filterCount(F, { sigOn: true, sigActive: true }), 3);
  assert.equal(filterCount(F, { sigOn: false, sigActive: true }), 2);
});
test("resetFilters : garde Garder / exclure, remet tout le reste", () => {
  const F = createFilterState({ sigFilter: true });
  F.req.m.add(1);
  F.ban.c.add(2);
  setKeywords(F, "x");
  F.nums.tMax = 10;
  F.tags.f.add(4);
  F.notTags.d.add(5);
  F.noFranchise = true;
  F.rate.b.hi = 7;
  resetFilters(F);
  assert.equal(F.kwText, "");
  assert.equal(F.nums.tMax, null);
  assert.equal(F.tags.f.size + F.notTags.d.size, 0);
  assert.ok(!F.noFranchise && !F.sigFilter && !rateActive(F, "b"));
  assert.equal(reqBanCount(F), 2);
});
test("✓ ou ✕, jamais les deux (includeTag / excludeTag / addTag)", () => {
  const F = createFilterState({ reqKeys: ["m", "c", "f"], notTagKeys: ["d", "ar", "pu"] });
  includeTag(F, "m", 1);
  assert.ok(isIncluded(F, "m", 1));
  excludeTag(F, "m", 1);
  assert.ok(isExcluded(F, "m", 1) && !isIncluded(F, "m", 1));
  includeTag(F, "m", 1);
  assert.ok(isIncluded(F, "m", 1) && !isExcluded(F, "m", 1));
  includeTag(F, "m", 1); // second clic : retiré
  assert.ok(!isIncluded(F, "m", 1));
  includeTag(F, "pu", 7);
  assert.ok(F.tags.pu.has(7));
  excludeTag(F, "pu", 7);
  assert.ok(F.notTags.pu.has(7) && !F.tags.pu.has(7));
  F.ban.f.add(4);
  addTag(F, "f", 4);
  assert.ok(F.tags.f.has(4) && !F.ban.f.has(4));
  excludeTag(F, "f", 4);
  assert.ok(F.ban.f.has(4) && !F.tags.f.has(4));
});
test("computePass sur la fixture : défauts → tout passe ; « -dice » réduit", async () => {
  const w = await loadWorld();
  const F = createFilterState();
  const all = computePass(w.raw.nodes, F, w.ctx);
  assert.equal(
    all.reduce((a, b) => a + b, 0),
    w.raw.nodes.length,
  );
  setKeywords(F, "-dice");
  const some = computePass(w.raw.nodes, F, w.ctx);
  const n = some.reduce((a, b) => a + b, 0);
  assert.ok(n > 0 && n < w.raw.nodes.length);
});
