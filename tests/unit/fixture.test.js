// La fixture tests/fixtures/games.small.json a le format de web/data/games.js (src/export_web.py) : indices cohérents.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.js";

test("fixture : dictionnaires, indices et jeux de référence", () => {
  const D = loadFixture();
  assert.ok(D.nodes.length >= 20, "au moins 20 jeux");
  const ids = new Set(D.nodes.map((g) => g.id));
  for (const id of [167791, 30549, 13])
    assert.ok(ids.has(id), `jeu ${id} présent (Terraforming Mars, Pandemic, Catan)`);
  const within = (xs, n) => xs.every((t) => Number.isInteger(t) && t >= 0 && t < n);
  for (const g of D.nodes) {
    assert.ok(within(g.m, D.dict.mech.length), `${g.n} : mécaniques`);
    assert.ok(within(g.c, D.dict.cat.length), `${g.n} : catégories`);
    assert.ok(within(g.f, D.dict.fam.length), `${g.n} : familles`);
    assert.ok(within(g.d, D.dict.des.length) && within(g.ar, D.dict.art.length) && within(g.pu, D.dict.pub.length));
    assert.ok(within(g.x, D.dict.exp.length), `${g.n} : extensions`);
    assert.ok(
      within(
        g.dv.map((x) => x[0]),
        D.words.length,
      ),
      `${g.n} : mots-clés`,
    );
  }
  assert.equal(D.idf.mech.length, D.dict.mech.length);
  assert.equal(D.npmi.mech.length, D.dict.mech.length);
  assert.ok(D.meta.map_keys.length === 4 && D.nodes[0].xy.length === 4, "4 cartes par jeu");
});
