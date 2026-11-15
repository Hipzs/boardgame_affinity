import { test } from "node:test";
import assert from "node:assert/strict";
import { loadWorld } from "./helpers.js";
import { suggest, centroid, SUGGEST_WEIGHTS } from "../../web/lib/suggest.js";

const idx = (raw, id) => raw.nodes.findIndex((g) => g.id === id);

test("suggest : exclut les jeux de la collection, trié par score décroissant, scores dans [0, 1]", async () => {
  const { ATTRS, ATTR_KEYS, raw } = await loadWorld();
  const members = [idx(raw, 167791), idx(raw, 30549)];
  const out = suggest({ ATTRS, ATTR_KEYS, members, limit: 10 });
  assert.ok(out.length > 0);
  assert.ok(out.every((r) => !members.includes(r.i)));
  for (let k = 1; k < out.length; k++) assert.ok(out[k - 1].score >= out[k].score);
  assert.ok(out.every((r) => r.score > 0 && r.score <= 1 + 1e-9));
});
test("suggest : un jeu seul comme collection = ses voisins cosinus ; collection vide = rien ; pass filtre", async () => {
  const { ATTRS, ATTR_KEYS, raw } = await loadWorld();
  const u = idx(raw, 167791);
  const n = raw.nodes.length;
  const w = { m: 1, c: 0, f: 0, d: 0 };
  const out = suggest({ ATTRS, ATTR_KEYS, members: [u], w, limit: 5 });
  for (const r of out) {
    let s = 0;
    for (const [t, x] of ATTRS.m.vec[u]) s += x * (ATTRS.m.vec[r.i].get(t) || 0);
    assert.ok(Math.abs(s - r.score) < 1e-9);
  }
  assert.deepEqual(suggest({ ATTRS, ATTR_KEYS, members: [] }), []);
  const pass = new Uint8Array(n).fill(1);
  pass[out[0].i] = 0;
  assert.ok(suggest({ ATTRS, ATTR_KEYS, members: [u], w, pass, limit: 5 }).every((r) => r.i !== out[0].i));
});
test("centroid : norme 1 ; poids par défaut somment à 1", async () => {
  const { ATTRS, raw } = await loadWorld();
  const c = centroid(ATTRS, "m", [idx(raw, 167791), idx(raw, 30549)]);
  assert.ok(Math.abs(Math.hypot(...c.values()) - 1) < 1e-9);
  assert.ok(Math.abs(Object.values(SUGGEST_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
