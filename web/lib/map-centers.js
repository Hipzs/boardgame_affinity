// @ts-check
/** @import { RawData } from "../types" */
/* Centres des thèmes, sur chaque carte.
 * Groupes = thèmes (catégories BGG) réunis par émoji (ex. 🪖 = toutes les guerres modernes), hors catégories de format
 * ou de licence (emoji.js, nonThematic). Un jeu appartient à un groupe s'il en a au moins une catégorie, avec un
 * poids w = (nb de ses catégories thématiques dans le groupe) / (nb total de ses catégories thématiques) : un jeu
 * mono-thème pèse plus qu'un jeu à cinq thèmes. Centre = moyenne pondérée ou pic d'enrichissement, calculé une fois
 * par carte (une par attribut) et mis en cache. */

/**
 * @param {{D: RawData, EMO: any, NON_THEMATIC: Set<number>}} data
 */
export function createCenters({ D, EMO, NON_THEMATIC }) {
  const N = D.nodes;
  /** Position du jeu i sur la carte mi (les jeux de `onMap` ont toutes leurs positions). */
  const xyOf = (/** @type {number} */ i, /** @type {number} */ mi) => /** @type {[number, number]} */ (N[i].xy?.[mi]);
  /** Poids du jeu i dans le groupe f (0 s'il n'y appartient pas). */
  const weightOf = (/** @type {number} */ i, /** @type {string} */ f) => GAME_FAMS[i].get(f) ?? 0;
  const onMap = N.map((g, i) => i).filter((i) => N[i].xy);
  /** @type {Record<string, {emoji: string, cats: string[], label?: string}>} */
  const GROUPS = {};
  const GROUP_OF_CAT = D.dict.cat.map((/** @type {string} */ name, /** @type {number} */ t) => {
    if (NON_THEMATIC.has(t)) return null;
    const e = EMO.themes[name];
    if (!e) return null;
    (GROUPS[e] = GROUPS[e] || { emoji: e, cats: [] }).cats.push(name);
    return e;
  });
  for (const G of Object.values(GROUPS))
    G.label = G.cats.length > 2 ? `${G.cats[0]}, ${G.cats[1]}… (${G.cats.length})` : G.cats.join(", ");
  const FAM_KEYS = Object.keys(GROUPS);
  const GAME_FAMS = N.map((g) => {
    /** @type {Map<string, number>} */
    const c = new Map();
    const th = g.c.filter((t) => GROUP_OF_CAT[t]);
    for (const t of th) c.set(GROUP_OF_CAT[t], (c.get(GROUP_OF_CAT[t]) || 0) + 1);
    for (const [f, n] of c) c.set(f, n / th.length);
    return c;
  });
  const FAM_MEMBERS = Object.fromEntries(FAM_KEYS.map((f) => [f, onMap.filter((i) => GAME_FAMS[i].has(f))]));
  /** @type {Map<number, Record<string, any>>} */
  const centCache = new Map();
  /** @type {Map<number, Record<string, any>>} */
  const peakCache = new Map();

  /** Centroïde pondéré de chaque groupe sur la carte mi ; « les grandes familles retombent au milieu ». */
  function centroids(/** @type {number} */ mi) {
    const cached = centCache.get(mi);
    if (cached) return cached;
    /** @type {Record<string, any>} */
    const out = {};
    for (const f of FAM_KEYS) {
      let sw = 0,
        sx = 0,
        sy = 0;
      for (const i of FAM_MEMBERS[f]) {
        const w = weightOf(i, f),
          [x, y] = xyOf(i, mi);
        sw += w;
        sx += w * x;
        sy += w * y;
      }
      if (!sw) continue;
      const cx = sx / sw,
        cy = sy / sw;
      let v = 0; // dispersion : écart quadratique moyen pondéré au centroïde
      for (const i of FAM_MEMBERS[f]) {
        const w = weightOf(i, f),
          [x, y] = xyOf(i, mi);
        v += w * ((x - cx) ** 2 + (y - cy) ** 2);
      }
      out[f] = { f, x: cx, y: cy, n: FAM_MEMBERS[f].length, spread: Math.sqrt(v / sw) };
    }
    centCache.set(mi, out);
    return out;
  }

  /** Pic d'enrichissement : grille G×G, densités lissées (gaussienne σ = 1,5 cellule) de la famille (F, pondérée par w) et
   *  de tous les jeux (A) ; enrichissement E = (F/ΣF) / (A/ΣA), maximisé parmi les cellules où F ≥ 20 % de son maximum. */
  function peaks(/** @type {number} */ mi) {
    const cached = peakCache.get(mi);
    if (cached) return cached;
    const G = 64;
    const xs = onMap.map((i) => xyOf(i, mi)[0]).sort((a, b) => a - b);
    const ys = onMap.map((i) => xyOf(i, mi)[1]).sort((a, b) => a - b);
    const q = (/** @type {number[]} */ a, /** @type {number} */ p) => a[Math.floor(p * (a.length - 1))];
    const x0 = q(xs, 0.01),
      x1 = q(xs, 0.99),
      y0 = q(ys, 0.01),
      y1 = q(ys, 0.99);
    const cell = (/** @type {number} */ i) => {
      const [x, y] = xyOf(i, mi);
      const cx = Math.min(G - 1, Math.max(0, Math.floor(((x - x0) / (x1 - x0)) * G)));
      const cy = Math.min(G - 1, Math.max(0, Math.floor(((y - y0) / (y1 - y0)) * G)));
      return cy * G + cx;
    };
    const cellOf = onMap.map(cell);
    const kern = [-3, -2, -1, 0, 1, 2, 3].map((d) => Math.exp(-(d * d) / (2 * 1.5 * 1.5)));
    const blur = (/** @type {Float64Array} */ h) => {
      // flou gaussien séparable
      const tmp = new Float64Array(G * G),
        out = new Float64Array(G * G);
      for (let y = 0; y < G; y++)
        for (let x = 0; x < G; x++) {
          let v = 0;
          for (let k = -3; k <= 3; k++) {
            const xx = x + k;
            if (xx >= 0 && xx < G) v += kern[k + 3] * h[y * G + xx];
          }
          tmp[y * G + x] = v;
        }
      for (let y = 0; y < G; y++)
        for (let x = 0; x < G; x++) {
          let v = 0;
          for (let k = -3; k <= 3; k++) {
            const yy = y + k;
            if (yy >= 0 && yy < G) v += kern[k + 3] * tmp[yy * G + x];
          }
          out[y * G + x] = v;
        }
      return out;
    };
    const A = new Float64Array(G * G);
    onMap.forEach((_, k) => {
      A[cellOf[k]]++;
    });
    const Ab = blur(A),
      sA = Ab.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0);
    const pos = new Map(onMap.map((i, k) => [i, cellOf[k]]));
    /** @type {Record<string, any>} */
    const out = {},
      base = /** @type {Record<string, any>} */ (centroids(mi));
    for (const f of FAM_KEYS) {
      if (!base[f]) continue;
      const F = new Float64Array(G * G);
      for (const i of FAM_MEMBERS[f]) F[pos.get(i) ?? 0] += weightOf(i, f);
      const Fb = blur(F),
        sF = Fb.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0),
        fMax = Math.max(...Fb);
      let best = -1,
        bestE = -1;
      for (let c = 0; c < G * G; c++) {
        if (Fb[c] < 0.2 * fMax || Ab[c] <= 0) continue;
        const E = Fb[c] / sF / (Ab[c] / sA);
        if (E > bestE) {
          bestE = E;
          best = c;
        }
      }
      const cx = best % G,
        cy = Math.floor(best / G);
      out[f] = { ...base[f], x: x0 + ((cx + 0.5) / G) * (x1 - x0), y: y0 + ((cy + 0.5) / G) * (y1 - y0), lift: bestE };
    }
    peakCache.set(mi, out);
    return out;
  }
  return {
    onMap,
    GROUPS,
    FAM_KEYS,
    GAME_FAMS,
    FAM_MEMBERS,
    centroids,
    peaks,
    centers: (/** @type {number} */ mi, /** @type {string} */ mode) => (mode === "peak" ? peaks(mi) : centroids(mi)),
  };
}
