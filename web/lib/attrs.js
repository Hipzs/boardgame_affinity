// @ts-check
/* Attributs (blocs d'étiquettes) : quatre attributs, chacun un ensemble d'étiquettes par jeu, avec un poids IDF.
 *   m : mécaniques · c : thème (catégories BGG) · f : familles fines · d : description (40 mots-clés TF-IDF)
 * Toute métrique s'applique à chaque attribut ; la ressemblance est la somme pondérée par les curseurs. */
import { FAM_SKIP } from "./dataset.js";

/** @param {ArrayLike<number>} counts @param {number} nDocs @param {(t: number) => boolean} [keep] */
export const smoothIdf = (counts, nDocs, keep = () => true) =>
  Array.from(counts, (x, t) => (x >= 2 && keep(t) ? Math.log((nDocs + 1) / (x + 1)) + 1 : 0));

/** @param {any} D  données brutes */
export function buildAttrs(D) {
  const N = D.nodes;
  const famIdf = (() => {
    const n = new Float64Array(D.dict.fam.length);
    N.forEach((g) => g.f.forEach((t) => n[t]++));
    return smoothIdf(n, N.length, (t) => !FAM_SKIP.test(D.dict.fam[t]));
  })();
  const ATTRS = {
    m: {
      label: "Mécaniques",
      short: "Méca.",
      dict: D.dict.mech,
      terms: (g) => g.m,
      idf: D.idf.mech,
      npmi: D.npmi.mech,
    },
    c: { label: "Thème", short: "Thème", dict: D.dict.cat, terms: (g) => g.c, idf: D.idf.cat, npmi: D.npmi.cat },
    f: {
      label: "Familles fines",
      short: "Familles",
      dict: D.dict.fam,
      terms: (g) => g.f.filter((t) => famIdf[t] > 0),
      idf: famIdf,
      npmi: D.npmi.fam,
    },
    // Description : les poids TF-IDF sont déjà dans dv (pas d'IDF supplémentaire) ; pas de matrice S (cosinus souple → cosinus).
    d: {
      label: "Description",
      short: "Descr.",
      dict: D.words,
      terms: (g) => g.dv.map((x) => x[0]),
      weights: (g) => g.dv,
      npmi: null,
    },
  };
  const ATTR_KEYS = Object.keys(ATTRS);
  for (const A of Object.values(ATTRS)) {
    const nT = A.dict.length;
    A.vec = new Array(N.length); // vecteur pondéré normalisé L2 : Map(t -> w)
    A.set = new Array(N.length); // ensemble brut des étiquettes
    A.post = Array.from({ length: nT }, () => []); // liste inversée : t -> [i]
    N.forEach((g, i) => {
      const ts = A.terms(g);
      A.set[i] = new Set(ts);
      const pairs = A.weights ? A.weights(g) : ts.filter((t) => A.idf[t] > 0).map((t) => [t, A.idf[t]]);
      const norm = Math.hypot(...pairs.map((x) => x[1])) || 1;
      A.vec[i] = new Map(pairs.map(([t, w]) => [t, w / norm]));
      for (const t of A.set[i]) A.post[t].push(i);
    });
    // Cosinus souple : S = I + max(0, NPMI) ; ‖x‖_S = √(xᵀ S x) précalculée par jeu.
    if (A.npmi) {
      const npmi = A.npmi;
      A.sTimes = (x) => {
        const out = new Float64Array(nT);
        for (const [t, w] of x) {
          out[t] += w;
          for (const [t2, sv] of npmi[t]) out[t2] += sv * w;
        }
        return out;
      };
      A.snorm = A.vec.map((x) => {
        if (!x.size) return 0;
        const sx = A.sTimes(x);
        let q = 0;
        for (const [t, w] of x) q += w * sx[t];
        return Math.sqrt(q);
      });
    }
  }
  const franchise = N.map((g) => new Set(g.f.filter((t) => D.dict.fam[t].startsWith("Game:"))));
  return { ATTRS, ATTR_KEYS, famIdf, franchise };
}
