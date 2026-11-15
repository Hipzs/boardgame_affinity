import { test } from "node:test";
import assert from "node:assert/strict";
import { createFilterState, setKeywords } from "../../web/lib/filters.js";
import { encodeView, decodeView, parseHash } from "../../web/lib/share-link.js";

const mkState = () => ({
  k: 5,
  depth: 2,
  cross: false,
  tau: 0,
  showRating: false,
  colorRating: false,
  wRaw: { m: 100, c: 0, f: 0, d: 0 },
  metric: "cos",
  signals: true,
  emoji: false,
  gems: true,
  gemBeta: 2,
  view: "graph",
});
const mkF = () => createFilterState({ reqKeys: ["m", "c", "f", "d"], notTagKeys: [], sigFilter: true });
const SIG = { wish: [80, 100], trade: [0, 30] };

test("parseHash : #id seul et #id~état", () => {
  assert.deepEqual(parseHash("#167791"), { id: "167791", share: null });
  assert.deepEqual(parseHash("#167791~abc"), { id: "167791", share: "abc" });
});
test("aller-retour : réglages, signaux et filtres identiques (accents compris)", () => {
  const state = {
    ...mkState(),
    k: 8,
    depth: 3,
    metric: "soft",
    wRaw: { m: 40, c: 30, f: 20, d: 10 },
    view: "map",
    cross: true,
    gems: false,
    gemBeta: 1.5,
    tau: 0.25,
  };
  const F = mkF();
  F.req.m.add(3);
  F.ban.c.add(7);
  F.tags.pu.add(12);
  F.rate.av.lo = 7;
  F.nums.plMin = 2;
  F.noReimpl = true;
  F.sigFilter = false;
  setKeywords(F, "dés -coopératif");
  const share = encodeView({ state, sigInt: { wish: [70, 95], trade: [0, 100] }, F });
  assert.match(share, /^[A-Za-z0-9_-]+$/);
  const G = mkF();
  const r = decodeView(share, G);
  assert.ok(r);
  assert.equal(r.state.k, 8);
  assert.equal(r.state.depth, 3);
  assert.equal(r.state.metric, "soft");
  assert.equal(r.state.view, "map");
  assert.equal(r.state.gems, false);
  assert.equal(r.state.tau, 0.25);
  assert.deepEqual(r.state.wRaw, { m: 40, c: 30, f: 20, d: 10 });
  assert.deepEqual(r.sigInt, { wish: [70, 95], trade: [0, 100] });
  assert.equal(r.sigFilter, false);
  assert.equal(r.options.noReimpl, true);
  assert.deepEqual([...G.req.m], [3]);
  assert.deepEqual([...G.ban.c], [7]);
  assert.deepEqual([...G.tags.pu], [12]);
  assert.equal(G.rate.av.lo, 7);
  assert.equal(G.nums.plMin, 2);
  assert.equal(G.kwText, "dés -coopératif");
});
test("état par défaut : lien court ; décodage d'une chaîne illisible ou hors bornes", () => {
  const share = encodeView({ state: mkState(), sigInt: SIG, F: mkF() });
  assert.ok(share.length < 200, `trop long : ${share.length}`);
  assert.equal(decodeView("%%%pas-du-base64", mkF()), null);
  const bad = btoa(
    JSON.stringify({ k: 99, d: 99, m: "zzz", v: "x", w: { m: 0, c: 0, f: 0, d: 0 }, sig: { wish: [90, 10] } }),
  );
  const r = decodeView(bad, mkF());
  assert.ok(r);
  assert.equal(r.state.k, undefined);
  assert.equal(r.state.depth, 6);
  assert.equal(r.state.metric, undefined);
  assert.equal(r.state.wRaw, undefined);
  assert.deepEqual(r.sigInt?.wish, [10, 90]);
});
test("décoder remet à zéro les filtres précédents", () => {
  const F = mkF();
  F.req.m.add(1);
  F.nums.tMax = 30;
  decodeView(encodeView({ state: mkState(), sigInt: SIG, F: mkF() }), F);
  assert.equal(F.req.m.size, 0);
  assert.equal(F.nums.tMax, null);
});
