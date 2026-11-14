// @ts-check
/* Recherche par mots-clés : texte normalisé (minuscules, sans accents) de chaque jeu, construit à la demande et mis en
 * cache. Champs : nom, début de description, 40 mots-clés TF-IDF, mécaniques, thèmes, familles, auteurs, illustrateurs,
 * éditeurs, extensions, année. Tous les mots doivent y être (sous-chaînes) ; « -mot » exclut. */

export const kwNorm = (x) => String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Saisie -> mots normalisés (un « - » seul est ignoré). */
export const kwTerms = (q) =>
  kwNorm(q)
    .split(/\s+/)
    .filter((w) => w && w !== "-");

/** Le texte contient-il tous les mots, et aucun mot précédé de « - » ? */
export function matchesKeywords(txt, terms) {
  for (const w of terms) if (w.startsWith("-") ? txt.includes(w.slice(1)) : !txt.includes(w)) return false;
  return true;
}

/** @param {any} D  données brutes ; renvoie g -> texte normalisé (cache par identifiant BGG) */
export function createKeywordText(D) {
  const cache = new Map();
  return (g) => {
    let t = cache.get(g.id);
    if (t === undefined) {
      t = kwNorm(
        [
          g.n,
          g.ds || "",
          g.y || "",
          ...(g.dv || []).map((x) => D.words[x[0]]),
          ...g.m.map((t) => D.dict.mech[t]),
          ...g.c.map((t) => D.dict.cat[t]),
          ...g.f.map((t) => D.dict.fam[t]),
          ...g.d.map((t) => D.dict.des[t]),
          ...g.ar.map((t) => D.dict.art[t]),
          ...g.pu.map((t) => D.dict.pub[t]),
          ...(g.x || []).map((t) => D.dict.exp[t]),
        ].join(" | "),
      );
      cache.set(g.id, t);
    }
    return t;
  };
}
