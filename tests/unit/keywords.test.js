import { test } from "node:test";
import assert from "node:assert/strict";
import { kwNorm, kwTerms, matchesKeywords } from "../../web/lib/keywords.js";
import { loadWorld } from "./helpers.js";

test("kwNorm : minuscules sans accents ; kwTerms ignore le « - » seul", () => {
  assert.equal(kwNorm("Mécanique ÉTÉ"), "mecanique ete");
  assert.deepEqual(kwTerms("  Dés  -  -cartes "), ["des", "-cartes"]);
});
test("matchesKeywords : tous les mots, « -mot » exclut", () => {
  const txt = "terraforming mars | engine building | dice";
  assert.ok(matchesKeywords(txt, ["mars", "engine"]));
  assert.ok(!matchesKeywords(txt, ["mars", "-dice"]));
  assert.ok(matchesKeywords(txt, ["-poker"]));
  assert.ok(!matchesKeywords(txt, ["poker"]));
  assert.ok(matchesKeywords(txt, []));
});
test("createKeywordText : le texte du jeu contient son nom normalisé et ses mécaniques", async () => {
  const w = await loadWorld();
  const tm = w.raw.nodes.find((g) => g.id === 167791);
  const txt = w.kwText(tm);
  assert.ok(txt.includes("terraforming mars"));
  for (const t of tm.m) assert.ok(txt.includes(w.raw.dict.mech[t].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()));
});
