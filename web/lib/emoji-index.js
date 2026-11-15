// @ts-check
/** @import { RawData } from "../types" */
/* Émojis (web/emoji.js) : un par thème, un par famille de mécaniques. */

/**
 * @param {RawData} D  données brutes
 * @param {any} EMO  dictionnaire d'émojis ({themes, families, nonThematic})
 */
export function buildEmojiIndex(D, EMO = { themes: {}, families: {} }) {
  const N = D.nodes;
  /** @type {Record<string, string>} */
  const famOfMech = {};
  for (const [k, f] of Object.entries(EMO.families)) for (const m of f.mechanics) famOfMech[m] = k;
  const MECH_FAM = D.dict.mech.map((m) => famOfMech[m] || "");
  const missing = {
    mecaniques: D.dict.mech.filter((m) => !famOfMech[m]),
    themes: D.dict.cat.filter((c) => !EMO.themes[c]),
  };
  /** Émoji d'une étiquette (mécaniques et thèmes seulement) ; « · » si absente du dictionnaire. */
  function emo(/** @type {string} */ key, /** @type {number} */ t) {
    if (key === "m") return (EMO.families[MECH_FAM[t]] || {}).emoji || "·";
    if (key === "c") return EMO.themes[D.dict.cat[t]] || "·";
    return "";
  }
  // Thème dominant d'un jeu : sa catégorie thématique la plus spécifique (IDF maximal, hors catégories de format
  // ou de licence listées dans emoji.js) ; sans catégorie, la famille de sa mécanique la plus spécifique.
  const NON_THEMATIC = new Set(
    (EMO.nonThematic || [])
      .map((/** @type {string} */ n) => D.dict.cat.indexOf(n))
      .filter((/** @type {number} */ t) => t >= 0),
  );
  const DOM_EMO = N.map((g) => {
    const best = (/** @type {number[]} */ ts, /** @type {ArrayLike<number>} */ idf) =>
      ts.reduce((/** @type {number | null} */ b, t) => (b === null || idf[t] > idf[b] ? t : b), null);
    const thematic = g.c.filter((t) => !NON_THEMATIC.has(t));
    const c = best(thematic.length ? thematic : g.c, D.idf.cat);
    if (c !== null) return emo("c", c);
    const m = best(g.m, D.idf.mech);
    return m !== null ? emo("m", m) : "";
  });
  return { emo, MECH_FAM, DOM_EMO, NON_THEMATIC, missing };
}
