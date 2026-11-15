// @ts-check
/* Co-occurrences d'étiquettes (mécaniques) : comptes, lift, NPMI, ordre et groupes par classification hiérarchique.
 *   P(a) = n_a / N ,  P(a,b) = n_ab / N
 *   lift(a,b) = P(a,b) / (P(a)P(b))          (> 1 : plus associées que si indépendantes)
 *   PMI(a,b)  = ln lift ;  NPMI = PMI / (−ln P(a,b)) ∈ [−1, 1]   (0 : indépendantes, 1 : toujours ensemble)
 * Classification : agglomérative, lien moyen, distance d = 1 − NPMI ∈ [0, 2] ; l'ordre des feuilles du dendrogramme
 * place côte à côte les étiquettes qui vont ensemble (blocs sur la diagonale de la carte de chaleur). */

/**
 * @param {{m: number[]}[]} nodes  jeux (`m` : indices d'étiquettes)  @param {number} nTags
 * @returns {{N: number, count: Int32Array, pair: (a: number, b: number) => number}}
 */
export function buildCooccurrence(nodes, nTags) {
  const count = new Int32Array(nTags);
  /** @type {Map<number, number>} */
  const pairs = new Map();
  for (const g of nodes) {
    const m = [...new Set(g.m)].sort((x, y) => x - y);
    for (let i = 0; i < m.length; i++) {
      count[m[i]]++;
      for (let j = i + 1; j < m.length; j++) {
        const key = m[i] * nTags + m[j];
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }
  return {
    N: nodes.length,
    count,
    pair: (a, b) => (a === b ? count[a] : pairs.get(a < b ? a * nTags + b : b * nTags + a) || 0),
  };
}

/** @param {{N: number, count: Int32Array, pair: (a: number, b: number) => number}} co @param {number} a @param {number} b */
export function lift(co, a, b) {
  const nab = co.pair(a, b);
  return nab ? (nab * co.N) / (co.count[a] * co.count[b]) : 0;
}
/** NPMI ∈ [−1, 1] ; −1 si jamais ensemble (convention) ; 1 sur la diagonale. @param {{N: number, count: Int32Array, pair: (a: number, b: number) => number}} co @param {number} a @param {number} b */
export function npmi(co, a, b) {
  if (a === b) return 1;
  const nab = co.pair(a, b);
  if (!nab) return -1;
  const pab = nab / co.N;
  if (pab >= 1) return 1;
  return Math.log((nab * co.N) / (co.count[a] * co.count[b])) / -Math.log(pab);
}

/** Les n étiquettes les plus fréquentes (au moins minCount jeux). @param {Int32Array} count @param {number} n @param {number} [minCount] */
export function topTags(count, n, minCount = 1) {
  return Array.from(count, (c, t) => [t, c])
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, n)
    .map(([t]) => t);
}

/**
 * Classification agglomérative (lien moyen) sur une matrice de distances.
 * @param {number} n  nombre d'éléments  @param {(i: number, j: number) => number} dist
 * @returns {{order: number[], cut: (k: number) => number[]}}
 *   order : permutation des éléments (ordre des feuilles) ; cut(k) : groupe (0..k−1) de chaque élément pour k groupes
 */
export function cluster(n, dist) {
  if (n === 0) return { order: [], cut: () => [] };
  /** @type {{members: number[], left?: number, right?: number}[]} */
  const nodes = Array.from({ length: n }, (_, i) => ({ members: [i] }));
  /** @type {Map<number, Map<number, number>>} distances entre clusters actifs (clé = id de nœud) */
  const d = new Map();
  for (let i = 0; i < n; i++) {
    const row = new Map();
    for (let j = 0; j < n; j++) if (j !== i) row.set(j, dist(i, j));
    d.set(i, row);
  }
  /** @type {number[][]} groupes obtenus après chaque fusion (pour cut) : merges[s] = [a, b, nouveauId] */
  const merges = [];
  while (d.size > 1) {
    let best = [-1, -1],
      bd = Infinity;
    for (const [i, row] of d) for (const [j, v] of row) if (i < j && v < bd) ((bd = v), (best = [i, j]));
    const [a, b] = best;
    const id = nodes.length;
    nodes.push({ members: [...nodes[a].members, ...nodes[b].members], left: a, right: b });
    const na = nodes[a].members.length,
      nb = nodes[b].members.length;
    const row = new Map();
    for (const c of d.keys()) {
      if (c === a || c === b) continue;
      const v = ((d.get(a)?.get(c) ?? 0) * na + (d.get(b)?.get(c) ?? 0) * nb) / (na + nb); // lien moyen (UPGMA)
      row.set(c, v);
      d.get(c)?.set(id, v);
      d.get(c)?.delete(a);
      d.get(c)?.delete(b);
    }
    d.delete(a);
    d.delete(b);
    d.set(id, row);
    merges.push([a, b, id]);
  }
  const root = nodes.length - 1;
  /** @param {number} i @returns {number[]} */
  const leaves = (i) => nodes[i].members; // members est déjà dans l'ordre gauche → droite
  const order = leaves(root);
  const pos = new Map(order.map((t, i) => [t, i]));
  return {
    order,
    cut(k) {
      const kk = Math.max(1, Math.min(n, k));
      // On défait les (kk − 1) dernières fusions : il reste kk clusters.
      const active = new Set([root]);
      for (let s = merges.length - 1, undone = 0; undone < kk - 1 && s >= 0; s--, undone++) {
        const [a, b, id] = merges[s];
        active.delete(id);
        active.add(a);
        active.add(b);
      }
      const label = new Array(n).fill(0);
      // Groupes numérotés dans l'ordre d'apparition sur la carte (de gauche à droite).
      const first = (/** @type {number} */ i) => Math.min(...nodes[i].members.map((m) => pos.get(m) ?? 0));
      let c = 0;
      for (const i of [...active].sort((x, y) => first(x) - first(y))) {
        for (const m of nodes[i].members) label[m] = c;
        c++;
      }
      return label;
    },
  };
}
