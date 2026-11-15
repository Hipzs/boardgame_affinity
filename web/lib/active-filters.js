// @ts-check
/* Liste des filtres actifs (overlay « Filtres ») : texte, groupe et fonction qui retire le filtre dans l'état.
 * Sans DOM : la page redessine ses champs après `clear(F)`. */
import { TAG_KEYS, TAG_NAMES } from "./dataset.js";
import { rateActive, resetRate } from "./filters.js";

/** @param {unknown} x */
export const fr = (x) => String(x).replace(".", ",");
/** @param {number | null} lo @param {number | null} hi @param {string} [unit] */
const span = (lo, hi, unit = "") =>
  lo !== null && hi !== null
    ? `${fr(lo)} à ${fr(hi)}${unit}`
    : lo !== null
      ? `≥ ${fr(lo)}${unit}`
      : `≤ ${fr(hi)}${unit}`;

/**
 * @param {any} F  FilterState
 * @param {{D: any, ATTRS?: any, dictOf: (key: string) => string[], reqLabel: (key: string) => string,
 *          mode: "explorer" | "collections", signals?: null | {text: string} }} ctx
 *   dictOf(key) : libellés d'un attribut (m, c, f, d) ; reqLabel(key) : « Méca. », « Thème »…
 *   signals : texte du filtre par signaux s'il est actif (explorateur)
 * @returns {{group: string, text: string, clear: (F: any) => void, cls: string}[]}
 */
export function activeFilters(F, ctx) {
  /** @type {{group: string, text: string, clear: (F: any) => void, cls: string}[]} */
  const out = [];
  const add = (
    /** @type {string} */ group,
    /** @type {string} */ text,
    /** @type {(F: any) => void} */ clear,
    cls = "",
  ) => out.push({ group, text, clear, cls });
  const explorer = ctx.mode === "explorer";
  const n = F.nums;
  const clearNums =
    (/** @type {string[]} */ ...ks) =>
    () =>
      ks.forEach((k) => (F.nums[k] = null));
  if (explorer) {
    for (const key of Object.keys(TAG_KEYS))
      for (const t of F.tags[key])
        add("Filtres", `${TAG_NAMES[key]} : ${ctx.D.dict[TAG_KEYS[key]][t]}`, () => F.tags[key].delete(t));
    if (F.kw.length) add("Filtres", `Mots-clés : « ${F.kwText.trim()} »`, () => ((F.kwText = ""), (F.kw = [])));
  } else if (F.kw.length) add("Mots-clés", `« ${F.kwText.trim()} »`, () => ((F.kwText = ""), (F.kw = [])));
  if (!explorer) {
    for (const k of F.reqKeys) {
      for (const t of F.req[k]) {
        const or = F.modeReq[k] === "or" && F.req[k].size > 1 ? ", OU" : "";
        add("Garder / exclure", `✓ ${ctx.dictOf(k)[t]} (${ctx.reqLabel(k)}${or})`, () => F.req[k].delete(t));
      }
      for (const t of F.ban[k])
        add("Garder / exclure", `✕ ${ctx.dictOf(k)[t]} (${ctx.reqLabel(k)})`, () => F.ban[k].delete(t), "ban");
    }
    for (const [k, name] of [
      ["av", "Note BGG"],
      ["b", "Note bayésienne"],
    ]) {
      if (rateActive(F, k))
        add("Filtres", `${name} : ${fr(F.rate[k].lo.toFixed(1))} à ${fr(F.rate[k].hi.toFixed(1))}`, () =>
          resetRate(F, k),
        );
    }
  }
  if (n.plMin !== null || n.plMax !== null)
    add("Filtres", `Joueurs : ${span(n.plMin, n.plMax)}`, clearNums("plMin", "plMax"));
  if (n.tMin !== null || n.tMax !== null)
    add("Filtres", `Durée : ${span(n.tMin, n.tMax, " min")}`, clearNums("tMin", "tMax"));
  if (n.ageMax !== null) add("Filtres", `Âge ≤ ${n.ageMax} ans`, clearNums("ageMax"));
  if (explorer && (n.wMin !== null || n.wMax !== null))
    add("Filtres", `Poids : ${span(n.wMin, n.wMax)}`, clearNums("wMin", "wMax"));
  if (explorer) {
    for (const [k, name] of [
      ["av", "Note BGG"],
      ["b", "Note bayésienne"],
    ]) {
      if (rateActive(F, k))
        add("Filtres", `${name} : ${fr(F.rate[k].lo.toFixed(1))} à ${fr(F.rate[k].hi.toFixed(1))}`, () =>
          resetRate(F, k),
        );
    }
    if (F.noFranchise) add("Filtres", "Sans franchise", () => (F.noFranchise = false));
    if (F.noReimpl) add("Filtres", "Sans réimplémentation", () => (F.noReimpl = false));
    if (F.noExpLine) add("Filtres", "Sans extension (même gamme)", () => (F.noExpLine = false));
    if (ctx.signals) add("Filtres", ctx.signals.text, () => (F.sigFilter = false));
    for (const key of F.reqKeys) {
      const A = ctx.dictOf(key);
      for (const t of F.req[key])
        add("Garder / exclure", `✓ ${A[t]} (${ctx.reqLabel(key)})`, () => F.req[key].delete(t));
      for (const t of F.ban[key])
        add("Garder / exclure", `✕ ${A[t]} (${ctx.reqLabel(key)})`, () => F.ban[key].delete(t), "ban");
    }
  } else {
    for (const k of Object.keys(TAG_KEYS)) {
      for (const t of F.tags[k]) {
        const et = F.modeTag[k] === "and" && F.tags[k].size > 1 ? " (ET)" : "";
        add("Filtres", `${TAG_NAMES[k]} : ${ctx.D.dict[TAG_KEYS[k]][t]}${et}`, () => F.tags[k].delete(t));
      }
    }
    for (const k of Object.keys(F.notTags))
      for (const t of F.notTags[k])
        add("Filtres", `✕ ${TAG_NAMES[k]} : ${ctx.D.dict[TAG_KEYS[k]][t]}`, () => F.notTags[k].delete(t), "ban");
  }
  return out;
}
