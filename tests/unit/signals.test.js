import { test } from "node:test";
import assert from "node:assert/strict";
import { bisectLeft, buildSignals, sigActive, inInt, SIG_DEFAULT } from "../../web/lib/signals.js";
import { buildGemQ } from "../../web/lib/gems.js";
import { loadFixture } from "./helpers.js";

test("bisectLeft : premier indice avec q[i] ≥ v", () => {
  const q = [1, 2, 2, 4];
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((v) => bisectLeft(q, v)),
    [0, 0, 1, 3, 3, 4],
  );
});
test("signaux : centiles dans [0, 100], intervalles actifs", () => {
  const N = loadFixture().nodes;
  const B = buildSignals(N);
  for (const k of ["wish", "trade"]) {
    assert.equal(B[k].pct.length, N.length);
    assert.ok(B[k].pct.every((p) => p >= 0 && p <= 100));
    assert.ok(Math.min(...B[k].pct) === 0, "le plus bas est au centile 0");
  }
  assert.ok(sigActive(SIG_DEFAULT, "wish") && sigActive(SIG_DEFAULT, "trade"));
  assert.ok(!sigActive({ wish: [0, 100], trade: [0, 100] }, "wish"));
  const all = { wish: [0, 100], trade: [0, 100] };
  assert.ok(N.every((_, i) => inInt(B, all, "wish", i)));
});
test("gems : qualité dans [0, 1]", () => {
  const q = buildGemQ(loadFixture().nodes);
  assert.ok(q.every((x) => x >= 0 && x <= 1));
});
