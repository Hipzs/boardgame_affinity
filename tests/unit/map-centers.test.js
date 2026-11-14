import { test } from "node:test";
import assert from "node:assert/strict";
import { createCenters } from "../../web/lib/map-centers.js";
import { buildEmojiIndex } from "../../web/lib/emoji-index.js";
import { EMOJI } from "../../web/emoji.js";
import { loadFixture } from "./helpers.js";

test("centres : un centroïde par groupe présent, pic dans le cadre des positions, caches stables", () => {
  const D = loadFixture();
  const { NON_THEMATIC } = buildEmojiIndex(D, EMOJI);
  const C = createCenters({ D, EMO: EMOJI, NON_THEMATIC });
  const cent = C.centroids(0);
  assert.ok(Object.keys(cent).length > 0);
  assert.equal(C.centroids(0), cent, "cache");
  const xs = C.onMap.map((i) => D.nodes[i].xy[0][0]);
  for (const c of Object.values(cent))
    assert.ok(c.x >= Math.min(...xs) - 1e-9 && c.x <= Math.max(...xs) + 1e-9 && c.n > 0);
  const pk = C.centers(0, "peak");
  assert.deepEqual(Object.keys(pk), Object.keys(cent));
  for (const p of Object.values(pk)) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.lift > 0);
  assert.equal(C.centers(0, "mean"), cent);
});
