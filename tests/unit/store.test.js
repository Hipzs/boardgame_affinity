import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../../web/lib/store.js";

test("store : set fusionne, update mute ou remplace, subscribe/unsubscribe", () => {
  const s = createStore({ a: 1, b: new Set() });
  const seen = [];
  const off = s.subscribe((st) => seen.push(st.a));
  s.set({ a: 2 });
  s.update((st) => {
    st.b.add(1);
  });
  s.update((st) => ({ ...st, a: 3 }));
  assert.deepEqual(seen, [2, 2, 3]);
  assert.ok(s.get().b.has(1));
  off();
  s.set({ a: 4 });
  assert.deepEqual(seen, [2, 2, 3]);
});
