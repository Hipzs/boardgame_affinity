import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPanelHtml } from "../../web/ui/filter-panel/markup.js";

const COMMON = [
  "reset",
  "f-kw",
  "filter-count",
  "req-count",
  "req-m",
  "req-c",
  "req-f",
  "req-clear",
  "filters-sum",
  "weight-row",
];
const RATES = ["av", "b"].flatMap((k) => [`${k}-out`, `${k}-int`, `${k}-lo`, `${k}-hi`]);
const NUMS = ["pl-min", "pl-max", "t-min", "t-max", "age-max", "w-min", "w-max"];
const TAGS = ["f", "d", "ar", "pu"].flatMap((k) => [`tf-${k}`, `dl-${k}`]);
const ids = (h) => [...h.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

for (const mode of ["explorer", "collections"]) {
  test(`panneau ${mode} : ids attendus présents, sans doublon`, () => {
    const h = filterPanelHtml({ mode, nGames: 4672, afterKeywords: '<div id="f-save"></div>' });
    const found = ids(h);
    for (const id of [...COMMON, ...RATES, ...NUMS, ...TAGS]) assert.ok(found.includes(id), `${mode} : #${id}`);
    assert.equal(new Set(found).size, found.length, "ids uniques");
  });
}
test("spécificités : Options et req-d seulement dans l'explorateur ; sections repliables et f-save dans collections", () => {
  const e = ids(filterPanelHtml({ mode: "explorer", nGames: 10 }));
  const c = ids(filterPanelHtml({ mode: "collections", nGames: 10, afterKeywords: '<div id="f-save"></div>' }));
  for (const id of ["no-reimpl", "no-franchise", "no-expline", "emoji", "req-d"])
    assert.ok(e.includes(id) && !c.includes(id), id);
  for (const id of ["sec-n-m", "sec-n-c", "sec-n-f", "f-save"]) assert.ok(c.includes(id) && !e.includes(id), id);
  assert.match(filterPanelHtml({ mode: "explorer", nGames: 4672 }), /dans les 4672 jeux/);
});
