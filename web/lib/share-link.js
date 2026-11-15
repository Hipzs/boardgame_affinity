// @ts-check
/* Lien de partage d'une vue de l'explorateur : l'état est sérialisé en JSON compact (valeurs par défaut omises),
 * encodé en base64 URL-safe et placé dans le hash : `#<id BGG>~<état>`. Le format `#<id>` seul reste valide. */
import { serializeUI, deserializeUI } from "./ui-persistence.js";
import { KS, D_MAX } from "./bfs.js";
import { METRIC_KEYS } from "./metrics.js";

/** Séparateur entre l'identifiant BGG et l'état encodé. */
export const SEP = "~";
const VIEWS = ["graph", "map"];
const SIG = ["wish", "trade"];

/** @param {string} s */
function toB64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** @param {string} b */
function fromB64(b) {
  const bin = atob(b.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Décompose un hash (`#167791` ou `#167791~…`). @param {string} hash @returns {{id: string, share: string | null}} */
export function parseHash(hash) {
  const h = hash.replace(/^#/, "");
  const j = h.indexOf(SEP);
  return j < 0 ? { id: h, share: null } : { id: h.slice(0, j), share: h.slice(j + 1) };
}

/** Un objet est « vide » s'il ne contient que des valeurs par défaut/vides. @param {any} v */
const empty = (v) =>
  v === null ||
  v === undefined ||
  v === false ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v).every(empty));
/** Retire récursivement les valeurs vides. @param {any} v @returns {any} */
function prune(v) {
  if (Array.isArray(v) || typeof v !== "object" || v === null) return v;
  const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, prune(x)]));
  for (const k of Object.keys(out)) if (empty(out[k])) delete out[k];
  return out;
}

/**
 * Réglages de la vue -> chaîne partageable.
 * @param {{state: any, sigInt: Record<string, number[]>, F: any}} p
 *   state : état de l'explorateur ; sigInt : intervalles de centiles ; F : FilterState
 */
export function encodeView({ state, sigInt, F }) {
  const f = serializeUI(F, { selected: -1, expanded: {}, showAll: false, sort: "" });
  /** @type {Record<string, any>} */
  const fv = { ...f };
  for (const k of ["selected", "expanded", "showAll", "sort"]) delete fv[k];
  // Les valeurs par défaut des notes et des bornes numériques sont retirées par prune/filtrage.
  fv.nums = Object.fromEntries(Object.entries(f.nums).filter(([, v]) => v !== ""));
  fv.rate = Object.fromEntries(Object.entries(f.rate).filter(([k, v]) => v[0] > F.rate[k].min || v[1] < F.rate[k].max));
  fv.modeReq = Object.fromEntries(Object.entries(f.modeReq).filter(([, v]) => v !== "and"));
  fv.modeTag = Object.fromEntries(Object.entries(f.modeTag).filter(([, v]) => v !== "or"));
  const o = {
    k: state.k,
    d: state.depth,
    x: state.cross,
    t: state.tau,
    r: state.showRating,
    cr: state.colorRating,
    w: state.wRaw,
    m: state.metric,
    s: state.signals,
    e: state.emoji,
    g: state.gems,
    gb: state.gemBeta,
    v: state.view,
    sig: sigInt,
    sf: F.sigFilter,
    nf: F.noFranchise,
    nr: F.noReimpl,
    ne: F.noExpLine,
    f: fv,
  };
  // Les booléens faux sont omis par prune ; on garde donc explicitement ceux dont le défaut est vrai.
  const kept = { s: state.signals, g: state.gems, sf: F.sigFilter };
  return toB64(JSON.stringify({ ...prune(o), ...Object.fromEntries(Object.entries(kept).map(([k, v]) => [k, !!v])) }));
}

/**
 * Chaîne partagée -> réglages validés (champs illisibles ou hors bornes ignorés), ou null.
 * `f` est appliqué à F (modifié en place) ; le reste est renvoyé pour que la page l'applique à son état.
 * @param {string} share @param {any} F  FilterState (modifié en place)
 * @returns {null | {state: Record<string, any>, sigInt: Record<string, number[]> | null, sigFilter: boolean | null,
 *                   options: {noFranchise: boolean, noReimpl: boolean, noExpLine: boolean}}}
 */
export function decodeView(share, F) {
  /** @type {any} */
  let o;
  try {
    o = JSON.parse(fromB64(share));
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  /** @type {Record<string, any>} */
  const st = {};
  const num = (/** @type {any} */ v, /** @type {number} */ lo, /** @type {number} */ hi) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;
  if (KS.includes(o.k)) st.k = o.k;
  const d = num(o.d, 1, D_MAX);
  if (d !== null) st.depth = Math.round(d);
  const tau = num(o.t, 0, 1);
  if (tau !== null) st.tau = tau;
  const gb = num(o.gb, 0, 5);
  if (gb !== null) st.gemBeta = gb;
  for (const [short, key] of [
    ["x", "cross"],
    ["r", "showRating"],
    ["cr", "colorRating"],
    ["s", "signals"],
    ["e", "emoji"],
    ["g", "gems"],
  ])
    st[key] = !!o[short];
  if (METRIC_KEYS.includes(o.m)) st.metric = o.m;
  if (VIEWS.includes(o.v)) st.view = o.v;
  if (o.w && typeof o.w === "object") {
    /** @type {Record<string, number>} */
    const w = {};
    for (const k of ["m", "c", "f", "d"]) w[k] = num(o.w[k], 0, 100) ?? 0;
    if (Object.values(w).some((x) => x > 0)) st.wRaw = w;
  }
  /** @type {Record<string, number[]> | null} */
  let sigInt = null;
  if (o.sig && typeof o.sig === "object") {
    sigInt = {};
    for (const k of SIG) {
      const v = o.sig[k];
      sigInt[k] =
        Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)
          ? [Math.max(0, Math.min(100, v[0])), Math.max(0, Math.min(100, v[1]))].sort((a, b) => a - b)
          : [0, 100];
    }
  }
  // Filtres : remise à zéro puis application (deserializeUI ignore ce qui est invalide).
  for (const k of Object.keys(F.nums)) F.nums[k] = null;
  for (const k of ["av", "b"]) [F.rate[k].lo, F.rate[k].hi] = [F.rate[k].min, F.rate[k].max];
  for (const m of Object.keys(F.modeReq)) F.modeReq[m] = "and";
  for (const m of Object.keys(F.modeTag)) F.modeTag[m] = "or";
  deserializeUI(F, { kw: "", ...(o.f && typeof o.f === "object" ? o.f : {}) }, { sorts: [], has: () => false });
  return {
    state: st,
    sigInt,
    sigFilter: typeof o.sf === "boolean" ? o.sf : null,
    options: { noFranchise: !!o.nf, noReimpl: !!o.nr, noExpLine: !!o.ne },
  };
}
