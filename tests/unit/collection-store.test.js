// Store « Mes collections » : API, migration v1, collections par défaut (une seule fois), import/export, synchro.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCollectionStore, KEY, OLD_KEY } from "../../web/lib/collection-store.js";
import { fakeStorage } from "./helpers.js";

const T0 = "2026-11-14T10:00:00.000Z";
function make(initial = {}, opts = {}) {
  const storage = fakeStorage(initial);
  let n = 0;
  const storageCbs = [];
  const store = createCollectionStore({
    storage,
    now: () => T0,
    newCid: () => `c${++n}`,
    addStorageListener: (cb) => storageCbs.push(cb),
    ...opts,
  });
  return { store, storage, storageCbs };
}

test("collections par défaut : semées une seule fois, jeux des collections ajoutés à la liste", () => {
  const defaults = { games: [], collections: [{ name: "A", color: "#e8590c", games: [1, 2] }] };
  const { store, storage } = make({}, { defaults });
  assert.deepEqual(
    store.list().map((g) => g.id),
    [1, 2],
  );
  assert.equal(store.collections()[0].cid, "cdef0");
  assert.deepEqual(store.inbox(), []);
  store.deleteCollection("cdef0");
  // un second store sur le même stockage ne ressème pas
  const again = createCollectionStore({ storage, defaults, now: () => T0 });
  assert.deepEqual(again.collections(), []);
  assert.equal(again.list().length, 2);
});

test("migration v1 : la liste devient les jeux, l'ancienne clé disparaît", () => {
  const { store, storage } = make({ [OLD_KEY]: JSON.stringify([{ id: 5, added: T0 }]) });
  assert.deepEqual(store.list(), [{ id: 5, added: T0 }]);
  assert.equal(storage.getItem(OLD_KEY), null);
  assert.ok(storage.getItem(KEY));
});

test("clean : données invalides ignorées, couleur invalide vidée", () => {
  const bad = {
    games: [{ id: 1 }, { id: "x" }, null],
    collections: [{ cid: "a", name: "N", color: "red", games: [1, "z"] }, { name: "sans cid" }],
  };
  const { store } = make({ [KEY]: JSON.stringify(bad) });
  assert.equal(store.list().length, 1);
  assert.deepEqual(store.collections(), [{ cid: "a", name: "N", color: "", created: "", games: [1] }]);
});

test("jeux : add, has, toggle, remove (retiré de toutes les collections), inbox", () => {
  const { store } = make();
  store.add(1);
  store.add(1);
  assert.equal(store.list().length, 1);
  const cid = store.createCollection("X", "#aabbcc");
  store.move(1, null, cid);
  assert.deepEqual(store.inbox(), []);
  assert.deepEqual(
    store.collectionsOf(1).map((c) => c.cid),
    [cid],
  );
  store.toggle(2);
  assert.ok(store.has(2));
  assert.deepEqual(
    store.inbox().map((g) => g.id),
    [2],
  );
  store.toggle(1);
  assert.ok(!store.has(1));
  assert.deepEqual(store.collections()[0].games, []);
});

test("collections : create, rename, update, reorder, delete, move (copie ou déplacement)", () => {
  const { store } = make();
  const a = store.createCollection("A"),
    b = store.createCollection("B"),
    c = store.createCollection("C");
  store.renameCollection(a, "A2");
  store.updateCollection(b, { name: "  B2 ", color: "#112233" });
  store.updateCollection(c, { name: "   " }); // nom vide ignoré
  assert.deepEqual(
    store.collections().map((x) => [x.name, x.color]),
    [
      ["A2", ""],
      ["B2", "#112233"],
      ["C", ""],
    ],
  );
  store.reorderCollection(c, a);
  assert.deepEqual(
    store.collections().map((x) => x.cid),
    [c, a, b],
  );
  store.reorderCollection(c, null);
  assert.deepEqual(
    store.collections().map((x) => x.cid),
    [a, b, c],
  );
  store.move(7, null, a);
  store.move(7, a, b, true); // copie
  assert.deepEqual(
    store.collectionsOf(7).map((x) => x.cid),
    [a, b],
  );
  store.move(7, a, c); // déplacement
  assert.deepEqual(
    store.collectionsOf(7).map((x) => x.cid),
    [b, c],
  );
  store.deleteCollection(b);
  store.deleteCollection(c);
  assert.deepEqual(
    store.inbox().map((g) => g.id),
    [7],
  ); // le jeu reste dans « Nouveaux jeux »
});

test("addMany : compte les nouveautés, une seule écriture", () => {
  const { store } = make();
  const cid = store.createCollection("A");
  store.add(1);
  let writes = 0;
  store.onChange(() => writes++);
  assert.deepEqual(store.addMany([1, 2, 3], cid), { added: 2, inColl: 3 });
  assert.equal(writes, 1);
  assert.deepEqual(store.addMany([1, 2], cid), { added: 0, inColl: 0 });
  assert.deepEqual(store.addMany([9]), { added: 1, inColl: 0 });
});

test("export / import : fusion par nom, v1 acceptée, vide refusé", () => {
  const { store } = make();
  const cid = store.createCollection("Tactique", "#112233");
  store.addMany([1, 2], cid);
  const dump = JSON.parse(store.exportJSON());
  assert.equal(dump.version, 2);
  const { store: other } = make();
  other.createCollection("Tactique");
  assert.deepEqual(other.importJSON(JSON.stringify(dump)), { games: 2, collections: 0 });
  assert.deepEqual(other.collections()[0].games, [1, 2]);
  const { store: v1 } = make();
  assert.deepEqual(v1.importJSON(JSON.stringify([{ id: 3, added: T0 }])), { games: 1, collections: 0 });
  assert.throws(() => v1.importJSON(JSON.stringify({ games: [], collections: [] })), /aucun jeu/);
  assert.throws(() => v1.importJSON("pas du json"));
});

test("événement storage : notifie seulement pour la bonne clé", () => {
  const { store, storageCbs } = make();
  let n = 0;
  store.onChange(() => n++);
  storageCbs[0]("autre");
  assert.equal(n, 0);
  storageCbs[0](KEY);
  assert.equal(n, 1);
});

test("stockage indisponible : repli mémoire sans exception", () => {
  const store = createCollectionStore({ storage: null, now: () => T0 });
  store.add(1);
  assert.ok(store.list().length <= 1); // pas d'exception ; relecture depuis la mémoire
});
