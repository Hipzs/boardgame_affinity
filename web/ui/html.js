// @ts-check
/* Aides DOM communes : échappement, gabarit HTML auto-échappant, délégation d'événements. */

/** @type {Record<string, string>} */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Échappe le texte pour l'insérer dans du HTML (contenu ou attribut). */
/** @param {unknown} s */
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ESC[ch]);
/** Nombre -> texte à la française (virgule décimale). */
/** @param {unknown} x */
export const fr = (x) => String(x).replace(".", ",");
/**
 * Élément du DOM par sélecteur. Typé `any` : les ids viennent du balisage de la page (et des tests de markup), pas de la saisie ;
 * un id manquant échoue tout de suite à l'usage plutôt que d'être masqué par un test de nullité partout.
 * @param {string} s
 * @param {ParentNode} [root]
 * @returns {any}
 */
export const $ = (s, root = document) => root.querySelector(s);

/** Fragment HTML déjà sûr, que `html` n'échappe pas. */
export class Raw {
  /** @param {string} s */
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
/** @param {unknown} s */
export const raw = (s) => new Raw(String(s));

/**
 * Gabarit HTML : chaque valeur interpolée est échappée, sauf un `raw(...)`, un `html`…`` imbriqué ou un tableau de ceux-ci.
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 */
export function html(strings, ...values) {
  /** @param {any} v @returns {string} */
  const part = (v) =>
    v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join("") : v == null || v === false ? "" : escapeHtml(v);
  let out = strings[0];
  values.forEach((v, i) => {
    out += part(v) + strings[i + 1];
  });
  return new Raw(out);
}

/**
 * Délégation d'événement : un seul écouteur sur `root`, valable pour les éléments redessinés ensuite.
 * @param {EventTarget} root
 * @param {string} type
 * @param {string} selector
 * @param {(e: Event, el: Element) => void} handler
 */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const t = e.target instanceof Element ? e.target.closest(selector) : null;
    if (t && /** @type {Node} */ (root).contains?.(t) !== false) handler(e, t);
  });
}
