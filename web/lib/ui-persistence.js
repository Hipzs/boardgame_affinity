// @ts-check
/* État de « Mes collections » mémorisé dans le navigateur (clé UI_KEY) : jeu affiché, filtres, rubriques dépliées, tri.
 * Retrouvé en revenant sur l'onglet, même si la page a été rechargée. Format stable (contrat) : ne pas le modifier. */
import { setKeywords, NUM_KEYS } from "./filters.js";

export const UI_KEY = "bga.collections.ui.v1";
/** Clé d'état -> identifiant du champ dans le format mémorisé. */
export const NUM_IDS = {
  plMin: "pl-min",
  plMax: "pl-max",
  tMin: "t-min",
  tMax: "t-max",
  ageMax: "age-max",
  wMin: "w-min",
  wMax: "w-max",
};
const arr = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));

/**
 * @param {any} F  FilterState
 * @param {{selected: number, expanded: Record<string, boolean>, showAll: boolean, sort: string}} ui
 */
export function serializeUI(F, ui) {
  return {
    selected: ui.selected,
    req: arr(F.req),
    ban: arr(F.ban),
    tags: arr(F.tags),
    notTags: arr(F.notTags),
    rate: { av: [F.rate.av.lo, F.rate.av.hi], b: [F.rate.b.lo, F.rate.b.hi] },
    nums: Object.fromEntries(NUM_KEYS.map((k) => [NUM_IDS[k], F.nums[k] === null ? "" : String(F.nums[k])])),
    expanded: ui.expanded,
    showAll: ui.showAll,
    sort: ui.sort,
    modeReq: F.modeReq,
    modeTag: F.modeTag,
    kw: F.kwText,
  };
}

/**
 * Applique un état lu (éventuellement illisible) à F ; renvoie les valeurs d'interface à restaurer.
 * @param {any} F  FilterState (modifié en place)
 * @param {any} st  objet lu dans le stockage
 * @param {{sorts: string[], has: (id: number) => boolean}} env  tris valides ; le jeu mémorisé est-il encore dans mes jeux ?
 * @returns {null | {selected: number | null, expanded: Record<string, boolean>, showAll: boolean, sort: string | null}}
 */
export function deserializeUI(F, st, env) {
  if (!st || typeof st !== "object") return null;
  const fill = (dst, src) => {
    for (const k of Object.keys(dst)) {
      dst[k].clear();
      (src?.[k] || []).forEach((t) => Number.isFinite(t) && dst[k].add(t));
    }
  };
  fill(F.req, st.req);
  fill(F.ban, st.ban);
  fill(F.tags, st.tags);
  fill(F.notTags, st.notTags);
  for (const k of ["av", "b"]) {
    const v = st.rate?.[k];
    if (Array.isArray(v) && v.every(Number.isFinite)) {
      F.rate[k].lo = Math.max(F.rate[k].min, Math.min(v[0], F.rate[k].max));
      F.rate[k].hi = Math.max(F.rate[k].lo, Math.min(v[1], F.rate[k].max));
    }
  }
  for (const k of NUM_KEYS) {
    const raw = st.nums?.[NUM_IDS[k]];
    if (typeof raw === "string") {
      const v = parseFloat(raw);
      F.nums[k] = Number.isFinite(v) ? v : null;
    }
  }
  if (typeof st.kw === "string") setKeywords(F, st.kw);
  for (const [dst, src] of [
    [F.modeReq, st.modeReq],
    [F.modeTag, st.modeTag],
  ])
    for (const k of Object.keys(dst)) if (src?.[k] === "and" || src?.[k] === "or") dst[k] = src[k];
  const expanded = { m: false, c: false, f: false };
  for (const k of Object.keys(expanded)) expanded[k] = !!st.expanded?.[k];
  return {
    selected: Number.isFinite(st.selected) && env.has(st.selected) ? st.selected : null, // jeu retiré entre-temps : pas restauré
    expanded,
    showAll: !!st.showAll,
    sort: st.sort && env.sorts.includes(st.sort) ? st.sort : null,
  };
}
