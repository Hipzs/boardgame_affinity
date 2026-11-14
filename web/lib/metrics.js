// @ts-check
/* Métriques de ressemblance, appliquées à chaque attribut, et pondération des attributs. */

export const METRICS = {
  cos: {
    label: "Cosinus IDF",
    short: "Cos IDF",
    help: "Cosinus entre vecteurs d'étiquettes pondérés par l'IDF (TF-IDF pour la description) : une étiquette rare partagée compte beaucoup, une banale peu. Métrique de référence.",
  },
  jac: {
    label: "Jaccard",
    short: "Jaccard",
    help: "|A∩B| / |A∪B| : part des étiquettes communes. Toutes les étiquettes pèsent pareil, banales comme rares.",
  },
  ovl: {
    label: "Recouvrement",
    short: "Recouv.",
    help: "|A∩B| / min(|A|,|B|) : vaut 1 si les étiquettes d'un jeu sont toutes dans l'autre. Trouve les versions simplifiées ou enrichies ; favorise les jeux à peu d'étiquettes.",
  },
  soft: {
    label: "Cosinus souple",
    short: "Souple",
    help: "Cosinus IDF où deux étiquettes différentes mais souvent associées sur BGG (NPMI > 0) comptent en partie comme communes : xᵀSy / (‖x‖_S‖y‖_S). Mécaniques, thème, familles ; la description retombe sur le cosinus.",
  },
};
export const METRIC_KEYS = Object.keys(METRICS);

/**
 * Ressemblance d'un attribut pour une paire, avec une métrique.
 * ctx (facultatif) : S·x_u déjà calculé pour le cosinus souple.
 */
export function attrPair(ATTRS, key, metric, u, v, ctx) {
  const A = ATTRS[key];
  if (metric === "jac" || metric === "ovl") {
    const a = A.set[u],
      b = A.set[v];
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    return metric === "jac" ? inter / (a.size + b.size - inter) : inter / Math.min(a.size, b.size);
  }
  if (metric === "soft" && A.npmi) {
    if (!A.snorm[u] || !A.snorm[v]) return 0;
    const su = (ctx && ctx[key]) || A.sTimes(A.vec[u]);
    let d = 0;
    for (const [t, w] of A.vec[v]) d += su[t] * w;
    return d / (A.snorm[u] * A.snorm[v]);
  }
  let s = 0; // cosinus (et repli du souple)
  const x = A.vec[v];
  for (const [t, w] of A.vec[u]) s += w * (x.get(t) || 0);
  return s;
}

/** Poids normalisés w_k = v_k / Σ v à partir des curseurs bruts (0–100). */
export function attrWeights(ATTR_KEYS, wRaw) {
  const tot = ATTR_KEYS.reduce((a, k) => a + wRaw[k], 0) || 1;
  return Object.fromEntries(ATTR_KEYS.map((k) => [k, wRaw[k] / tot]));
}

/** Clé de cache d'une configuration {metric, w}. */
export const cfgKey = (ATTR_KEYS, c) => `${c.metric}|${ATTR_KEYS.map((k) => c.w[k].toFixed(3)).join(",")}`;

/** Ressemblance d'une paire pour une configuration (infobulles, détails) et sa décomposition par attribut. */
export function pairDetail(ATTRS, ATTR_KEYS, u, v, cfg) {
  const parts = {};
  let s = 0;
  for (const key of ATTR_KEYS) {
    if (cfg.w[key] <= 0) continue;
    parts[key] = attrPair(ATTRS, key, cfg.metric, u, v);
    s += cfg.w[key] * parts[key];
  }
  return { s, parts };
}
