// @ts-check
/* Données : index et libellés dérivés de window.BGG_DATA (web/data/games.js, produit par src/export_web.py). */

/** Étiquettes « simples » filtrables par champ : clé du jeu -> dictionnaire. */
export const TAG_KEYS = { f: "fam", d: "des", ar: "art", pu: "pub" };
/** Nom affiché de chaque rubrique d'étiquettes. */
export const TAG_NAMES = { f: "Famille", d: "Auteur", ar: "Illustrateur", pu: "Éditeur" };
/** Familles BGG administratives, sans intérêt pour une recherche de ressemblance. */
export const FAM_SKIP = /^(Admin|Crowdfunding|Digital Implementations|Game|Versions & Editions|Misc):/;

/**
 * @param {any} D  données brutes (format de export_web.py)
 */
export function loadDataset(D) {
  const N = D.nodes;
  const label = (i) => `${N[i].n}${N[i].y ? ` (${N[i].y})` : ""}`;
  const byLabel = new Map(N.map((_, i) => [label(i).toLowerCase(), i]));
  const byId = new Map(N.map((g, i) => [g.id, i]));
  /** Indice d'un jeu d'après ce que tape l'utilisateur : libellé exact, nom exact, puis nom contenant la saisie. */
  function resolve(q) {
    q = q.trim().toLowerCase();
    if (!q) return -1;
    if (byLabel.has(q)) return byLabel.get(q);
    const exact = N.findIndex((g) => g.n.toLowerCase() === q);
    if (exact >= 0) return exact;
    return N.findIndex((g) => g.n.toLowerCase().includes(q));
  }
  /** Par rubrique d'étiquettes : libellé minuscule -> indice, fréquence, indices triés par fréquence décroissante. */
  const tagIndex = {},
    tagFreq = {},
    tagOrder = {};
  for (const [key, dname] of Object.entries(TAG_KEYS)) {
    const labels = D.dict[dname];
    tagIndex[key] = new Map(labels.map((l, i) => [l.toLowerCase(), i]));
    const freq = new Array(labels.length).fill(0);
    N.forEach((g) => g[key].forEach((t) => freq[t]++));
    tagFreq[key] = freq;
    tagOrder[key] = labels.map((_, i) => i).sort((a, b) => freq[b] - freq[a]);
  }
  return { D, N, byId, label, resolve, tagIndex, tagFreq, tagOrder };
}
