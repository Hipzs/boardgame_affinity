// @ts-check
/* Graphe : parcours en largeur des k plus proches voisins, et budget de nœuds. */

// Budget du graphe : au plus 300 jeux autour du jeu choisi. Voisins k ∈ KS = {1, …, 15}.
export const BUDGET = 300;
export const MAX_NODES = BUDGET + 1;
export const KS = Array.from({ length: 15 }, (_, j) => j + 1);
export const K_MAX = KS[KS.length - 1];
export const D_MAX = 6;

// Budget W(k, d) = k + k² + … + k^d ≤ 300 (pire cas : chaque niveau entièrement nouveau).
export const worst = (k, d) => {
  let t = 0,
    p = 1;
  for (let j = 1; j <= d; j++) {
    p *= k;
    t += p;
  }
  return t;
};
export const maxDepth = (k) => {
  let d = 1;
  while (d < D_MAX && worst(k, d + 1) <= BUDGET) d++;
  return d;
};
export const maxK = (d) => KS.filter((k) => worst(k, d) <= BUDGET).pop();

const pairKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * @param {{center: number, k: number, depth: number, cross: boolean, tau: number}} params
 * @param {(u: number) => any[]} neighborsOf  top-K_MAX voisins de u
 */
export function expand({ center, k, depth, cross, tau }, neighborsOf) {
  const level = new Map([[center, 0]]);
  const parent = new Map();
  const links = [];
  let frontier = [center];
  let truncated = false;
  let pruned = 0;
  // k plus proches voisins de u, puis seuil τ sur la similarité.
  const nbk = (u) => {
    const top = neighborsOf(u).slice(0, k);
    const kept = top.filter(([, s]) => s >= tau);
    return [kept, top.length - kept.length];
  };
  for (let d = 0; d < depth && frontier.length && !truncated; d++) {
    const next = [];
    for (const u of frontier) {
      const [kept, cut] = /** @type {[any[], number]} */ (nbk(u));
      pruned += cut;
      for (const [v, s] of kept) {
        if (level.has(v)) continue;
        if (level.size >= MAX_NODES) {
          truncated = true;
          break;
        }
        level.set(v, d + 1);
        parent.set(v, [u, s]);
        links.push({ source: u, target: v, s, cross: false });
        next.push(v);
      }
      if (truncated) break;
    }
    frontier = next;
  }
  if (cross) {
    // 12 voisins au plus par jeu : à k grand, presque toutes les paires seraient reliées (et le calcul long).
    const kc = Math.min(k, 12);
    const seen = new Set(links.map((l) => pairKey(l.source, l.target)));
    for (const u of level.keys()) {
      for (const [v, s] of neighborsOf(u)
        .slice(0, kc)
        .filter(([, x]) => x >= tau)) {
        if (!level.has(v) || seen.has(pairKey(u, v))) continue;
        seen.add(pairKey(u, v));
        links.push({ source: u, target: v, s, cross: true });
      }
    }
  }
  return { level, parent, links, truncated, pruned };
}
