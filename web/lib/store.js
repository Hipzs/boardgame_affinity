// @ts-check
/* Mini-store observable : un objet d'état, des abonnés notifiés après chaque modification. */

/**
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  let state = initial;
  /** @type {Set<(s: T) => void>} */
  const subs = new Set();
  const notify = () => subs.forEach((f) => f(state));
  return {
    get: () => state,
    /** Fusionne un patch (propriétés de premier niveau) puis notifie. */
    /** @param {Partial<T>} patch */
    set(patch) {
      state = { ...state, ...patch };
      notify();
    },
    /** Applique fn à l'état (mutation en place autorisée, p. ex. sur des Set) ; si fn renvoie un objet, il remplace l'état. */
    /** @param {(s: T) => T | void} fn */
    update(fn) {
      const r = fn(state);
      if (r !== undefined) state = r;
      notify();
    },
    /** @returns {() => void} désabonnement */
    /** @param {(s: T) => void} fn */
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
