// @ts-check
/* « Pépites cachées » : qualité q_v = Q_v · O_v ∈ [0,1] :
 *   Q_v = σ((note_v − 7) / 0,3)  (bien noté : 0,5 à 7, 0,97 à 8, 0,03 à 6)
 *   O_v = 1 − rang centile du nombre d'avis  (peu connu → 1, très connu → 0) */
export const GEM_RHO = 0.6;

/** @param {import("../types").Game[]} N */
export function buildGemQ(N) {
  const byR = N.map((_, i) => i).sort((a, b) => N[a].r - N[b].r);
  const pct = new Float64Array(N.length);
  byR.forEach((i, k) => {
    pct[i] = k / (N.length - 1);
  });
  return N.map((g, i) => (1 / (1 + Math.exp(-(g.av - 7) / 0.3))) * (1 - pct[i]));
}
