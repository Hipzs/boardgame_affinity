// @ts-check
/** @typedef {{id: string, short: string, label: string, help: string, top: number[]}} Conf */
/* Accord entre métriques / attributs : pour un jeu, top-k de chaque configuration et jeux « consensus » (présents dans au
 * moins la moitié des configurations). Calcul seul ; l'affichage (matrices) est dans la page. */
import { METRICS, METRIC_KEYS } from "./metrics.js";

/**
 * Configurations comparées : 4 métriques (pondération courante) puis 4 attributs seuls (métrique courante).
 * @param {{ATTRS: any, ATTR_KEYS: string[], base: {metric: string, w: Record<string, number>}, top: (cfg: any) => number[]}} a
 */
export function agreementConfigs({ ATTRS, ATTR_KEYS, base, top }) {
  const mConfs = METRIC_KEYS.map((m) => ({
    id: m,
    short: METRICS[m].short,
    label: METRICS[m].label,
    help: `${METRICS[m].label} : ${METRICS[m].help}`,
    top: top({ ...base, metric: m }),
  }));
  const aConfs = ATTR_KEYS.map((key) => ({
    id: key,
    short: ATTRS[key].short,
    label: ATTRS[key].label,
    help: `${ATTRS[key].label} seul, avec la métrique ${METRICS[base.metric].label}.`,
    top: top({ ...base, w: Object.fromEntries(ATTR_KEYS.map((x) => [x, x === key ? 1 : 0])) }),
  }));
  return { mConfs, aConfs };
}

/**
 * Jeux présents dans le top de ≥ la moitié des configurations, triés par nombre puis rang moyen.
 * @param {Conf[]} mConfs
 * @param {Conf[]} aConfs
 */
export function consensus(mConfs, aConfs) {
  const all = mConfs
    .map((c) => ({ ...c, name: c.label }))
    .concat(aConfs.map((c) => ({ ...c, name: c.label + " seul" })));
  /** @type {Map<number, {n: number, rk: number, ms: string[]}>} */
  const count = new Map();
  all.forEach((c) =>
    c.top.forEach((v, r) => {
      const x = count.get(v) || { n: 0, rk: 0, ms: [] };
      x.n++;
      x.rk += r + 1;
      x.ms.push(c.name);
      count.set(v, x);
    }),
  );
  const half = Math.ceil(all.length / 2);
  const cons = [...count]
    .filter(([, c]) => c.n >= half)
    .sort((x, y) => y[1].n - x[1].n || x[1].rk / x[1].n - y[1].rk / y[1].n);
  return { all, half, cons };
}

/** Pourcentage de voisins communs entre deux tops (matrice d'accord). */
/** @param {number[]} a @param {number[]} b @param {number} k */
export const overlap = (a, b, k) => (k ? a.filter((v) => b.includes(v)).length / k : 0);
