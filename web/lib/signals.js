// @ts-check
/** @import { Game } from "../types" */
/* Signaux par jeu : convoitise et revente.
 * Log-ratios lissés (+1) des collections BGG : convoitise = ln((souhaits+1)/(possédés+1)), revente = ln((à échanger+1)/(possédés+1)).
 * Chaque jeu reçoit son centile (0–100) parmi les jeux de l'interface ; l'utilisateur choisit un intervalle de centiles par signal. */

/**
 * Premier indice i tel que q[i] ≥ v (q trié croissant) ; équivalent de d3.bisectLeft.
 * @param {ArrayLike<number>} q
 * @param {number} v
 */
export function bisectLeft(q, v) {
  let lo = 0,
    hi = q.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (q[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Préréglages d'intervalles de centiles [bas, haut] : [0, 100] = signal inactif. */
export const SIG_DEFAULT = { wish: [80, 100], trade: [0, 30] }; // « Convoité, gardé »

/** @param {Game[]} N */
export function buildSignals(N) {
  /** @type {Record<string, any>} */
  const BEH = {};
  /** @type {[string, (g: any) => number][]} */
  const defs = [
    ["wish", (g) => Math.log((g.wi + 1) / (g.ow + 1))],
    ["trade", (g) => Math.log((g.tr + 1) / (g.ow + 1))],
  ];
  for (const [key, f] of defs) {
    const x = Float64Array.from(N, f);
    const q = Float64Array.from(x).sort();
    const at = (/** @type {number} */ p) => q[Math.floor(p * (q.length - 1))];
    BEH[key] = { x, median: at(0.5), at, rank: (/** @type {number} */ v) => bisectLeft(q, v) / (q.length - 1) };
  }
  for (const key of ["wish", "trade"])
    BEH[key].pct = Float64Array.from(BEH[key].x, (/** @type {number} */ v) => 100 * BEH[key].rank(v));
  return BEH;
}

/** Un intervalle est actif s'il ne couvre pas toute la plage [0, 100]. */
/** @param {Record<string, number[]>} sigInt @param {string} k */
export const sigActive = (sigInt, k) => sigInt[k][0] > 0 || sigInt[k][1] < 100;
/** Le centile du jeu i est-il dans l'intervalle du signal k ? */
/** @param {Record<string, any>} BEH @param {Record<string, number[]>} sigInt @param {string} k @param {number} i */
export const inInt = (BEH, sigInt, k, i) => BEH[k].pct[i] >= sigInt[k][0] && BEH[k].pct[i] <= sigInt[k][1];
