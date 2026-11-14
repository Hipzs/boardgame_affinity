// @ts-check
/* Top-K_MAX voisins d'un jeu parmi les jeux qui passent les filtres, mis en cache tant que les réglages ne changent pas
 * (appeler invalidate() quand le filtre `pass`, les options ou β changent).
 * Candidats : jeux partageant au moins une étiquette d'un attribut pondéré ; tous les jeux en cosinus souple
 * (deux jeux sans étiquette commune peuvent y être proches). */
import { attrPair, cfgKey } from "./metrics.js";
import { GEM_RHO } from "./gems.js";
import { K_MAX } from "./bfs.js";

/**
 * @param {{N: any[], ATTRS: any, ATTR_KEYS: string[], franchise: Set<number>[], gemQ: ArrayLike<number>}} data
 */
export function createNeighborIndex({ N, ATTRS, ATTR_KEYS, franchise, gemQ }) {
  let cache = new Map();
  const seen = new Uint8Array(N.length);
  /**
   * @param {number} u  indice du jeu
   * @param {{metric: string, w: Record<string, number>}} cfg
   * @param {{gems: boolean, gemBeta: number, noFranchise: boolean, noReimpl: boolean, noExpLine: boolean}} opts
   * @param {Uint8Array} pass  1 si le jeu passe les filtres
   * @returns {any[][]}  [indice, similarité (, score pépite)]
   */
  function neighbors(u, cfg, opts, pass) {
    const ck = `${cfgKey(ATTR_KEYS, cfg)}|${opts.gems ? 1 : 0}|${u}`;
    const hit = cache.get(ck);
    if (hit) return hit;
    const active = ATTR_KEYS.filter((k) => cfg.w[k] > 0);
    let cand;
    if (cfg.metric === "soft") cand = N.map((_, i) => i);
    else {
      cand = [];
      for (const key of active) {
        for (const t of ATTRS[key].set[u])
          for (const v of ATTRS[key].post[t])
            if (!seen[v]) {
              seen[v] = 1;
              cand.push(v);
            }
      }
      cand.forEach((v) => {
        seen[v] = 0;
      });
    }
    const ctx = {};
    if (cfg.metric === "soft")
      for (const key of active) if (ATTRS[key].npmi) ctx[key] = ATTRS[key].sTimes(ATTRS[key].vec[u]);
    const fu = franchise[u],
      ru = N[u].ri;
    const out = [];
    for (const v of cand) {
      if (v === u || !pass[v]) continue;
      if (opts.noFranchise && fu.size && [...franchise[v]].some((t) => fu.has(t))) continue;
      if (opts.noReimpl && ru >= 0 && N[v].ri === ru) continue;
      if (opts.noExpLine && N[u].xl >= 0 && N[v].xl === N[u].xl) continue;
      let s = 0;
      for (const key of active) s += cfg.w[key] * attrPair(ATTRS, key, cfg.metric, u, v, ctx);
      if (s > 0) out.push([v, Math.min(s, 1)]);
    }
    let top;
    if (opts.gems) {
      // Mode pépites : parmi les candidats assez similaires (s ≥ ρ·s_max), classement par s·q_v^β.
      const sMax = out.reduce((m, x) => Math.max(m, x[1]), 0);
      top = out
        .filter((x) => x[1] >= GEM_RHO * sMax)
        .map(([v, s]) => [v, s, s * Math.pow(gemQ[v], opts.gemBeta)])
        .sort((a, b) => b[2] - a[2])
        .slice(0, K_MAX);
    } else {
      out.sort((a, b) => b[1] - a[1] || N[b[0]].b - N[a[0]].b); // score, puis note bayésienne
      top = out.slice(0, K_MAX);
    }
    cache.set(ck, top);
    return top;
  }
  return {
    neighbors,
    invalidate() {
      cache = new Map();
    },
  };
}
