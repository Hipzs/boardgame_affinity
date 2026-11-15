import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeUI, deserializeUI, UI_KEY } from "../../web/lib/ui-persistence.js";
import { createFilterState, setKeywords } from "../../web/lib/filters.js";

const mk = () => createFilterState({ reqKeys: ["m", "c", "f"] });
const ui = { selected: 42, expanded: { m: true, c: false, f: false }, showAll: true, sort: "name" };

test("clé de stockage stable", () => assert.equal(UI_KEY, "bga.collections.ui.v1"));
test("aller-retour : filtres, notes, nombres, modes, mots-clés", () => {
  const F = mk();
  F.req.m.add(3);
  F.ban.c.add(4);
  F.tags.ar.add(5);
  F.notTags.pu.add(6);
  F.rate.av.lo = 6;
  F.rate.b.hi = 8;
  F.nums.plMin = 2;
  F.nums.tMax = 90.5;
  F.modeReq.m = "or";
  F.modeTag.f = "and";
  setKeywords(F, "Mars -dice");
  const json = JSON.parse(JSON.stringify(serializeUI(F, ui)));
  assert.deepEqual(json.nums, {
    "pl-min": "2",
    "pl-max": "",
    "t-min": "",
    "t-max": "90.5",
    "age-max": "",
    "w-min": "",
    "w-max": "",
  });
  assert.deepEqual(json.rate, { av: [6, 9], b: [3.5, 8] });
  const G = mk();
  const r = deserializeUI(G, json, { sorts: ["name", "date"], has: (id) => id === 42 });
  assert.deepEqual([...G.req.m, ...G.ban.c, ...G.tags.ar, ...G.notTags.pu], [3, 4, 5, 6]);
  assert.equal(G.rate.av.lo, 6);
  assert.equal(G.rate.b.hi, 8);
  assert.equal(G.nums.plMin, 2);
  assert.equal(G.nums.tMax, 90.5);
  assert.equal(G.nums.ageMax, null);
  assert.equal(G.modeReq.m, "or");
  assert.equal(G.modeTag.f, "and");
  assert.equal(G.kwText, "Mars -dice");
  assert.deepEqual(G.kw, ["mars", "-dice"]);
  assert.deepEqual(r, { selected: 42, expanded: ui.expanded, showAll: true, sort: "name" });
});
test("jeu retiré, tri inconnu, données invalides : valeurs par défaut", () => {
  const F = mk();
  const r = deserializeUI(
    F,
    { selected: 7, sort: "zzz", rate: { av: ["x", 1] }, req: { m: [1, "a"] }, modeReq: { m: "xor" } },
    { sorts: ["name"], has: () => false },
  );
  assert.equal(r?.selected, null);
  assert.equal(r?.sort, null);
  assert.deepEqual([...F.req.m], [1]);
  assert.equal(F.modeReq.m, "and");
  assert.ok(!(F.rate.av.lo > 2));
  assert.equal(deserializeUI(F, null, { sorts: [], has: () => true }), null);
});
