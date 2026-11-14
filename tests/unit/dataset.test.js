import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset, TAG_KEYS } from "../../web/lib/dataset.js";
import { buildEmojiIndex } from "../../web/lib/emoji-index.js";
import { EMOJI } from "../../web/emoji.js";
import { loadFixture } from "./helpers.js";

test("dataset : libellés, résolution de saisie, index des étiquettes triés par fréquence", () => {
  const ds = loadDataset(loadFixture());
  const i = ds.byId.get(167791);
  assert.match(ds.label(i), /^Terraforming Mars/);
  assert.equal(ds.resolve("terraforming mars"), i);
  assert.equal(ds.resolve("TERRAFORMING"), i);
  assert.equal(ds.resolve(""), -1);
  assert.equal(ds.resolve("zzzzzz jeu inexistant"), -1);
  for (const key of Object.keys(TAG_KEYS)) {
    const o = ds.tagOrder[key],
      f = ds.tagFreq[key];
    for (let j = 1; j < o.length; j++) assert.ok(f[o[j - 1]] >= f[o[j]]);
  }
});
test("émojis : un émoji de thème dominant par jeu, « · » pour une étiquette inconnue", () => {
  const D = loadFixture();
  const E = buildEmojiIndex(D, EMOJI);
  assert.equal(E.DOM_EMO.length, D.nodes.length);
  assert.ok(E.DOM_EMO.some((e) => e && e !== "·"));
  assert.equal(E.emo("f", 0), "");
  const none = buildEmojiIndex(D, { themes: {}, families: {} });
  assert.equal(none.emo("c", 0), "·");
});
