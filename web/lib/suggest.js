// @ts-check
/** @import { Attrs } from "../types" */
/* Suggestions depuis une collection : profil = centroïde des vecteurs d'étiquettes de ses jeux (par attribut),
 * puis classement des autres jeux par cosinus pondéré avec ce profil.
 *   profil_a = normalisé( (1/n) Σ_{j ∈ collection} x_{a,j} )   (x_{a,j} : vecteur IDF normalisé L2 du jeu j)
 *   score(i) = Σ_a w_a · ⟨profil_a, x_{a,i}⟩      (cosinus, car les deux vecteurs sont de norme 1)
 * Seuls les jeux partageant au moins une étiquette avec le profil sont scorés (listes inversées `post`). */

/** Poids par défaut : mécaniques et thème dominent, familles et description complètent (réglage supposé). */
export const SUGGEST_WEIGHTS = { m: 0.4, c: 0.3, f: 0.15, d: 0.15 };

/**
 * @param {Attrs} ATTRS @param {string} key @param {number[]} members indices des jeux de la collection
 * @returns {Map<number, number>} centroïde normalisé L2 (vide si aucun jeu n'a d'étiquette)
 */
export function centroid(ATTRS, key, members) {
  /** @type {Map<number, number>} */
  const c = new Map();
  for (const i of members) for (const [t, w] of ATTRS[key].vec[i]) c.set(t, (c.get(t) || 0) + w);
  const norm = Math.hypot(...c.values());
  if (!norm) return new Map();
  for (const [t, w] of c) c.set(t, w / norm);
  return c;
}

/**
 * @param {{ATTRS: Attrs, ATTR_KEYS: string[], members: number[], w?: Record<string, number>,
 *          pass?: ArrayLike<number> | null, limit?: number}} p
 *   members : indices des jeux de la collection (exclus des résultats) ; pass : 1 = candidat autorisé (filtres).
 * @returns {{i: number, score: number, parts: Record<string, number>}[]} par score décroissant
 */
export function suggest({ ATTRS, ATTR_KEYS, members, w = SUGGEST_WEIGHTS, pass = null, limit = 20 }) {
  if (!members.length) return [];
  const wTot = ATTR_KEYS.reduce((a, k) => a + (w[k] || 0), 0) || 1;
  const inColl = new Set(members);
  /** @type {Map<number, Record<string, number>>} */
  const acc = new Map();
  for (const key of ATTR_KEYS) {
    const wk = (w[key] || 0) / wTot;
    if (wk <= 0) continue;
    const prof = centroid(ATTRS, key, members);
    /** @type {Map<number, number>} */
    const dots = new Map();
    for (const [t, pw] of prof)
      for (const i of ATTRS[key].post[t]) {
        if (inColl.has(i) || (pass && !pass[i])) continue;
        dots.set(i, (dots.get(i) || 0) + pw * (ATTRS[key].vec[i].get(t) || 0));
      }
    for (const [i, d] of dots) {
      const parts = acc.get(i) || {};
      parts[key] = d;
      acc.set(i, parts);
    }
  }
  const out = [];
  for (const [i, parts] of acc) {
    let score = 0;
    for (const key of ATTR_KEYS) score += ((w[key] || 0) / wTot) * (parts[key] || 0);
    out.push({ i, score, parts });
  }
  out.sort((a, b) => b.score - a.score || a.i - b.i);
  return out.slice(0, limit);
}
