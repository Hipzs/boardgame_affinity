import { test } from "node:test";
import assert from "node:assert/strict";
import { activeFilters } from "../../web/lib/active-filters.js";
import { createFilterState, setKeywords } from "../../web/lib/filters.js";

const D = { dict: { fam: ["F0", "F1"], des: ["A0"], art: ["I0"], pub: ["P0", "P1"], mech: ["Dés", "Cartes"] } };
const base = (mode) => ({ D, mode, dictOf: () => D.dict.mech, reqLabel: () => "Méca.", signals: null });

test("collections : mots-clés, Garder / exclure (OU), joueurs, exclusions", () => {
  const F = createFilterState({ reqKeys: ["m", "c", "f"] });
  setKeywords(F, "mars");
  F.req.m.add(0);
  F.req.m.add(1);
  F.modeReq.m = "or";
  F.ban.c.add(1);
  F.nums.plMin = 2;
  F.nums.plMax = 4;
  F.notTags.pu.add(1);
  const list = activeFilters(F, base("collections"));
  const texts = list.map((x) => x.text);
  assert.ok(texts.includes("« mars »"));
  assert.ok(texts.includes("✓ Dés (Méca., OU)"));
  assert.ok(texts.includes("✕ Cartes (Méca.)"));
  assert.ok(texts.includes("Joueurs : 2 à 4"));
  assert.ok(texts.includes("✕ Éditeur : P1"));
  assert.equal(list.find((x) => x.text.startsWith("✕ Cartes"))?.cls, "ban");
});
test("clear retire le filtre dans l'état", () => {
  const F = createFilterState();
  F.tags.f.add(1);
  F.nums.tMin = 30;
  F.noReimpl = true;
  F.sigFilter = true;
  const list = activeFilters(F, { ...base("explorer"), signals: { text: "Signaux : convoitise c80–c100" } });
  assert.deepEqual(
    list.map((x) => x.text),
    ["Famille : F1", "Durée : ≥ 30 min", "Sans réimplémentation", "Signaux : convoitise c80–c100"],
  );
  list.forEach((x) => x.clear(F));
  assert.equal(F.tags.f.size, 0);
  assert.equal(F.nums.tMin, null);
  assert.ok(!F.noReimpl && !F.sigFilter);
});
test("note : texte avec virgule décimale", () => {
  const F = createFilterState();
  F.rate.av.lo = 6.5;
  const [x] = activeFilters(F, base("explorer"));
  assert.equal(x.text, "Note BGG : 6,5 à 9,0");
});
