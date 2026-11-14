#!/usr/bin/env node
/* Génère une petite fixture de données à partir du vrai web/data/games.js (6 Mo, gitignoré, produit par src/export_web.py).
 *
 * Jeux gardés : Terraforming Mars et ses 12 voisins (cosinus IDF sur les mécaniques, comme la métrique de référence
 * de l'interface), les jeux des collections par défaut (web/default-collections.js), Pandemic et Catan (utilisés par les
 * tests), plus 3 cas limites (jeu sans carte, sans nombre de joueurs, sans extension). Les dictionnaires (mécaniques,
 * catégories, familles, auteurs, illustrateurs, éditeurs, extensions, mots) sont réduits aux étiquettes utilisées et les
 * indices remappés ; idf et npmi sont tronqués en conséquence. Le format reste exactement celui de export_web.py.
 *
 * Sorties (versionnées) : tests/fixtures/games.small.js (window.BGG_DATA = …, pour le navigateur)
 *                        tests/fixtures/games.small.json (pour les tests Node)
 * Usage : node tests/fixtures/make-small.mjs   (npm run fixture) — à relancer après chaque nouvel export des données.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const src = join(root, "web", "data", "games.js");
if (!existsSync(src)) {
  console.error(`Données absentes : ${src}. Lancer d'abord src/export_web.py.`);
  process.exit(1);
}

// --- Chargement sans navigateur : le fichier affecte window.BGG_DATA --------------------------------------------
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(src, "utf8"), sandbox);
const D = sandbox.window.BGG_DATA;
const N = D.nodes;
const byId = new Map(N.map((g, i) => [g.id, i]));

// --- Choix des jeux -------------------------------------------------------------------------------------------
const TM = 167791,
  PANDEMIC = 30549,
  CATAN = 13;
const defaults = [262712, 177736, 167791, 218074, 265017, 256960, 295770, 192135, 268201, 191189, 273703]; // default-collections.js
const idf = D.idf.mech;
const vec = (g) => {
  const pairs = g.m.filter((t) => idf[t] > 0).map((t) => [t, idf[t]]);
  const norm = Math.hypot(...pairs.map((x) => x[1])) || 1;
  return new Map(pairs.map(([t, w]) => [t, w / norm]));
};
const cos = (a, b) => {
  let s = 0;
  for (const [t, w] of a) s += w * (b.get(t) || 0);
  return s;
};
const vTM = vec(N[byId.get(TM)]);
const neighbours = N.map((g, i) => [i, cos(vTM, vec(g))])
  .filter(([i]) => N[i].id !== TM)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([i]) => N[i].id);
const edge = (pred) => {
  const g = N.find((x) => pred(x) && !keepIds.has(x.id));
  return g ? [g.id] : [];
};
const keepIds = new Set([TM, PANDEMIC, CATAN, ...defaults, ...neighbours]);
for (const id of edge((g) => !g.xy)) keepIds.add(id); // sans carte
for (const id of edge((g) => !g.p[0] || !g.p[1])) keepIds.add(id); // sans nombre de joueurs
for (const id of edge((g) => g.x.length === 0 && g.f.length === 0)) keepIds.add(id); // sans extension ni famille
const kept = N.filter((g) => keepIds.has(g.id));

// --- Remappage des dictionnaires ------------------------------------------------------------------------------
const FIELDS = { m: "mech", c: "cat", f: "fam", d: "des", ar: "art", pu: "pub", x: "exp" };
const used = Object.fromEntries(Object.values(FIELDS).map((k) => [k, new Set()]));
const usedWords = new Set();
for (const g of kept) {
  for (const [f, dk] of Object.entries(FIELDS)) for (const t of g[f]) used[dk].add(t);
  for (const [w] of g.dv) usedWords.add(w);
}
const remap = (dictKey) => {
  const olds = [...used[dictKey]].sort((a, b) => a - b);
  return { list: olds.map((t) => D.dict[dictKey][t]), map: new Map(olds.map((t, j) => [t, j])) };
};
const R = Object.fromEntries(Object.values(FIELDS).map((k) => [k, remap(k)]));
const wOld = [...usedWords].sort((a, b) => a - b);
const wMap = new Map(wOld.map((t, j) => [t, j]));

const nodes = kept.map((g) => {
  const n = { ...g };
  for (const [f, dk] of Object.entries(FIELDS)) n[f] = g[f].map((t) => R[dk].map.get(t));
  n.dv = g.dv.map(([w, v]) => [wMap.get(w), v]);
  return n;
});
const sliceIdf = (dk) => R[dk].list.map((_, j) => D.idf[dk][[...R[dk].map.entries()].find(([, v]) => v === j)[0]]);
const sliceNpmi = (dk) => {
  const inv = [...R[dk].map.entries()];
  return inv.map(([old]) =>
    (D.npmi[dk][old] || []).filter(([t2]) => R[dk].map.has(t2)).map(([t2, s]) => [R[dk].map.get(t2), s]),
  );
};
const out = {
  meta: { ...D.meta, source: `${D.meta.source} (fixture ${kept.length} jeux)` },
  dict: Object.fromEntries(Object.values(FIELDS).map((dk) => [dk, R[dk].list])),
  idf: { mech: sliceIdf("mech"), cat: sliceIdf("cat") },
  words: wOld.map((t) => D.words[t]),
  npmi: { mech: sliceNpmi("mech"), cat: sliceNpmi("cat"), fam: sliceNpmi("fam") },
  nodes,
};

const json = JSON.stringify(out);
writeFileSync(join(here, "games.small.json"), json + "\n");
writeFileSync(join(here, "games.small.js"), `window.BGG_DATA = ${json};\n`);
console.log(
  `${nodes.length} jeux, ${out.dict.mech.length} mécaniques, ${out.dict.cat.length} catégories, ${out.words.length} mots -> games.small.js (${(json.length / 1024).toFixed(0)} Ko)`,
);
