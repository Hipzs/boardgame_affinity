// @ts-check
/** @import { FilterState, Game } from "../types" */
/* Filtres : état unique (FilterState) et prédicat unique `passes`, communs à l'explorateur et à « Mes collections ».
 *
 *   kw / kwText     recherche par mots-clés (kw = mots normalisés, kwText = saisie brute)
 *   nums            joueurs, durée, âge max, poids : intervalles saisis (null = libre)
 *   rate            notes BGG et bayésienne : intervalle [lo, hi], inactif s'il couvre toute la plage
 *   req / ban       étiquettes indispensables / interdites par attribut (m, c, f, + d = mots de la description dans l'explorateur)
 *   modeReq         « and » (toutes) ou « or » (au moins une) pour les indispensables de chaque attribut
 *   tags / notTags  famille, auteur, illustrateur, éditeur : choisis (modeTag : « or » = au moins un) / exclus
 *   noFranchise, noReimpl, noExpLine  options (explorateur) : traitées par le calcul des voisins, comptées ici
 *   sigFilter       les signaux (convoitise, revente) filtrent aussi (explorateur)
 * Aucun accès au DOM : les pages lisent leurs champs puis appellent `passes`. */
import { matchesKeywords, kwTerms } from "./keywords.js";

export const RATE_DEFAULTS = {
  av: { min: 2, max: 9 },
  b: { min: 3.5, max: 8.6 },
};
export const NUM_KEYS = ["plMin", "plMax", "tMin", "tMax", "ageMax", "wMin", "wMax"];
/** @param {string[]} keys */
const sets = (keys) => Object.fromEntries(keys.map((k) => [k, new Set()]));

/**
 * @param {{reqKeys?: string[], notTagKeys?: string[], sigFilter?: boolean}} [opts]
 * @returns {import("../types").FilterState}
 */
export function createFilterState({
  reqKeys = ["m", "c", "f", "d"],
  notTagKeys = ["d", "ar", "pu"],
  sigFilter = false,
} = {}) {
  return {
    reqKeys,
    kw: /** @type {string[]} */ ([]),
    kwText: "",
    nums: Object.fromEntries(NUM_KEYS.map((k) => [k, null])),
    rate: {
      av: { ...RATE_DEFAULTS.av, lo: RATE_DEFAULTS.av.min, hi: RATE_DEFAULTS.av.max },
      b: { ...RATE_DEFAULTS.b, lo: RATE_DEFAULTS.b.min, hi: RATE_DEFAULTS.b.max },
    },
    req: sets(reqKeys),
    ban: sets(reqKeys),
    modeReq: Object.fromEntries(reqKeys.map((k) => [k, "and"])),
    tags: sets(["f", "d", "ar", "pu"]),
    notTags: sets(notTagKeys),
    modeTag: { f: "or", d: "or", ar: "or", pu: "or" },
    noFranchise: false,
    noReimpl: false,
    noExpLine: false,
    sigFilter,
  };
}

/** Met à jour la recherche par mots-clés (saisie brute + mots normalisés).  @param {FilterState} F @param {string} text */
export function setKeywords(F, text) {
  F.kwText = text;
  F.kw = kwTerms(text);
}
/** @param {FilterState} F @param {string} k */
export const rateActive = (F, k) => F.rate[k].lo > F.rate[k].min || F.rate[k].hi < F.rate[k].max;
/** @param {FilterState} F @param {string} k */
export const resetRate = (F, k) => {
  F.rate[k].lo = F.rate[k].min;
  F.rate[k].hi = F.rate[k].max;
};

/**
 * Le jeu g (indice i) passe-t-il les filtres ?
 * @param {any} g
 * @param {number} i
 * @param {FilterState} F
 * @param {{kwText: (g: any, i: number) => string, terms: (g: any, i: number, key: string) => Set<number>,
 *          signals?: null | {active: (k: string) => boolean, inInt: (k: string, i: number) => boolean}}} ctx
 *   kwText : texte normalisé du jeu ; terms : étiquettes d'un attribut ; signals : null = signaux sans effet
 */
export function passes(g, i, F, ctx) {
  if (F.kw.length && !matchesKeywords(ctx.kwText(g, i), F.kw)) return false;
  for (const k of ["av", "b"]) if (rateActive(F, k) && (g[k] < F.rate[k].lo || g[k] > F.rate[k].hi)) return false;
  // Signaux : chaque intervalle actif doit contenir le centile du jeu (signaux indépendants).
  if (ctx.signals && F.sigFilter)
    for (const k of ["wish", "trade"]) if (ctx.signals.active(k) && !ctx.signals.inInt(k, i)) return false;
  for (const key of F.reqKeys) {
    const req = F.req[key],
      ban = F.ban[key];
    if (!req.size && !ban.size) continue;
    const has = ctx.terms(g, i, key);
    if (req.size && (F.modeReq[key] === "and" ? [...req].some((t) => !has.has(t)) : ![...req].some((t) => has.has(t))))
      return false;
    for (const t of ban) if (has.has(t)) return false;
  }
  for (const key of Object.keys(F.tags)) {
    const sel = F.tags[key];
    if (!sel.size) continue;
    const has = new Set(g[key]);
    if (F.modeTag[key] === "and" ? [...sel].some((t) => !has.has(t)) : ![...sel].some((t) => has.has(t))) return false;
  }
  for (const key of Object.keys(F.notTags))
    if (F.notTags[key].size && /** @type {number[]} */ (g[key]).some((t) => F.notTags[key].has(t))) return false;
  const n = F.nums;
  if (n.plMin !== null || n.plMax !== null) {
    const [mn, mx] = g.p;
    if (!mn || !mx) return false;
    if (mn > (n.plMax ?? Infinity) || mx < (n.plMin ?? 0)) return false; // intersection d'intervalles non vide
  }
  if (n.tMin !== null || n.tMax !== null) if (!g.t || g.t < (n.tMin ?? 0) || g.t > (n.tMax ?? Infinity)) return false;
  if (n.ageMax !== null && (!g.a || g.a > n.ageMax)) return false;
  if (n.wMin !== null || n.wMax !== null)
    if (g.w === null || g.w < (n.wMin ?? 0) || g.w > (n.wMax ?? Infinity)) return false;
  return true;
}

/** Table 0/1 des jeux qui passent (explorateur : base des voisins).  @param {Game[]} N @param {FilterState} F @param {Parameters<typeof passes>[3]} ctx */
export const computePass = (N, F, ctx) => Uint8Array.from(N, (g, i) => (passes(g, i, F, ctx) ? 1 : 0));

/** Nombre d'étiquettes « indispensables » + « interdites » (badge de la rubrique Garder / exclure).  @param {FilterState} F */
export const reqBanCount = (F) => F.reqKeys.reduce((n, k) => n + F.req[k].size + F.ban[k].size, 0);

/**
 * Nombre de filtres actifs (badge de « Filtres »).
 * @param {FilterState} F
 * @param {{sigOn?: boolean, sigActive?: boolean, reqInCount?: boolean}} [o]
 *   sigOn+sigActive : les signaux filtrent et au moins un intervalle est actif ; reqInCount : Garder / exclure compté (+1)
 */
export function filterCount(F, { sigOn = false, sigActive = false, reqInCount = false } = {}) {
  const n = F.nums;
  return (
    (F.kw.length ? 1 : 0) +
    Object.values(F.tags).filter((s) => s.size).length +
    Object.values(F.notTags).filter((s) => s.size).length +
    [n.plMin ?? n.plMax, n.tMin ?? n.tMax, n.ageMax, n.wMin ?? n.wMax].filter((x) => x !== null).length +
    (F.noFranchise ? 1 : 0) +
    (F.noReimpl ? 1 : 0) +
    (F.noExpLine ? 1 : 0) +
    (sigOn && F.sigFilter && sigActive ? 1 : 0) +
    (rateActive(F, "av") ? 1 : 0) +
    (rateActive(F, "b") ? 1 : 0) +
    (reqInCount && reqBanCount(F) ? 1 : 0)
  );
}

/** « Réinitialiser » : tout sauf Garder / exclure (qui a son propre bouton « Effacer »).  @param {FilterState} F */
export function resetFilters(F) {
  setKeywords(F, "");
  for (const k of NUM_KEYS) F.nums[k] = null;
  for (const s of Object.values(F.tags)) s.clear();
  for (const s of Object.values(F.notTags)) s.clear();
  F.noFranchise = F.noReimpl = F.noExpLine = false;
  F.sigFilter = false;
  for (const k of ["av", "b"]) resetRate(F, k);
}

/** « Effacer » de Garder / exclure.  @param {FilterState} F */
export function clearReqBan(F) {
  for (const k of F.reqKeys) {
    F.req[k].clear();
    F.ban[k].clear();
  }
}

// --- Sélection / exclusion d'une étiquette (clic sur une étiquette du jeu affiché, saisie dans un champ) ------------
// Une étiquette est soit sélectionnée (✓), soit barrée (✕), jamais les deux. Mécaniques, thème, familles fines :
// « Garder / exclure » (req / ban) ; auteur, illustrateur, éditeur : champs (tags / notTags).
/** @param {string} key */
const viaReq = (key) => key === "m" || key === "c" || key === "f";
/** @param {FilterState} F @param {string} key @param {number} t */
export const isIncluded = (F, key, t) => !!((viaReq(key) && F.req[key]?.has(t)) || F.tags[key]?.has(t));
/** @param {FilterState} F @param {string} key @param {number} t */
export const isExcluded = (F, key, t) => (viaReq(key) ? F.ban[key]?.has(t) : F.notTags[key]?.has(t)) || false;

/** Bascule le filtre positif ; déjà actif (y compris sous Famille) : retiré partout.  @param {FilterState} F @param {string} key @param {number} t */
export function includeTag(F, key, t) {
  if (isIncluded(F, key, t)) {
    if (viaReq(key)) F.req[key]?.delete(t);
    F.tags[key]?.delete(t);
  } else {
    if (viaReq(key)) {
      F.ban[key]?.delete(t);
      F.req[key]?.add(t);
    } else {
      F.notTags[key]?.delete(t);
      F.tags[key]?.add(t);
    }
  }
}
/** Bascule l'exclusion ; exclure retire toute sélection (y compris sous Famille / Auteur / Éditeur).  @param {FilterState} F @param {string} key @param {number} t */
export function excludeTag(F, key, t) {
  if (isExcluded(F, key, t)) {
    if (viaReq(key)) F.ban[key]?.delete(t);
    else F.notTags[key]?.delete(t);
  } else {
    if (viaReq(key)) {
      F.req[key]?.delete(t);
      F.tags[key]?.delete(t);
      F.ban[key]?.add(t);
    } else {
      F.tags[key]?.delete(t);
      F.notTags[key]?.add(t);
    }
  }
}
/** Ajout depuis un champ (Famille, Auteur…) : la même famille ne reste pas interdite.  @param {FilterState} F @param {string} key @param {number} t */
export function addTag(F, key, t) {
  if (key === "f") F.ban.f?.delete(t);
  F.notTags[key]?.delete(t);
  F.tags[key].add(t);
}
