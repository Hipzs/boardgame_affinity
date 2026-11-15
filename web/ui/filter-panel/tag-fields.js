// @ts-check
/* Champs d'étiquettes (famille, auteur, illustrateur, éditeur) : saisie avec suggestions, et pastilles des choix
 * (✓ choisis dans F.tags, ✕ exclus dans F.notTags). Clic sur une pastille : la retirer. */
import { escapeHtml } from "../html.js";
import { TAG_KEYS } from "../../lib/dataset.js";
import { addTag } from "../../lib/filters.js";

/**
 * @param {{D: any, F: any, suggestions: (key: string) => [number, number][], onChange: () => void, hideHelp: () => void}} o
 *   suggestions(key) : [indice d'étiquette, nombre de jeux] triés pour la liste déroulante
 */
export function createTagFields({ D, F, suggestions, onChange, hideHelp }) {
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (document.querySelector(s));
  const name = (/** @type {string} */ key, /** @type {number} */ t) => D.dict[TAG_KEYS[key]][t];
  function drawSuggestions() {
    for (const key of Object.keys(TAG_KEYS)) {
      $(`#dl-${key}`).innerHTML = suggestions(key)
        .map(([t, n]) => `<option value="${escapeHtml(name(key, t))}">${n} jeu${n > 1 ? "x" : ""}</option>`)
        .join("");
    }
  }
  function drawChips(/** @type {string} */ key) {
    const box = $(`.tagfilter[data-key="${key}"] .chips`);
    box.innerHTML =
      [...F.tags[key]]
        .map(
          (t) =>
            `<span class="chip removable" data-i="${t}" data-help="Clic : retirer ce filtre.">${escapeHtml(name(key, t))}</span>`,
        )
        .join("") +
      [...(F.notTags[key] || [])]
        .map(
          (t) =>
            `<span class="chip removable notag" data-n="${t}" data-help="Exclu : aucun jeu affiché ne doit l'avoir. Clic : retirer ce filtre.">✕ ${escapeHtml(name(key, t))}</span>`,
        )
        .join("");
    box.querySelectorAll(".chip[data-i]").forEach((c) =>
      c.addEventListener("click", () => {
        F.tags[key].delete(Number(/** @type {HTMLElement} */ (c).dataset.i));
        hideHelp();
        drawChips(key);
        onChange();
      }),
    );
    box.querySelectorAll(".chip[data-n]").forEach((c) =>
      c.addEventListener("click", () => {
        F.notTags[key].delete(Number(/** @type {HTMLElement} */ (c).dataset.n));
        hideHelp();
        drawChips(key);
        onChange();
      }),
    );
  }
  const drawAllChips = () => Object.keys(TAG_KEYS).forEach(drawChips);
  for (const key of Object.keys(TAG_KEYS)) {
    const input = /** @type {HTMLInputElement} */ ($(`#tf-${key}`));
    const index = new Map(
      D.dict[TAG_KEYS[key]].map((/** @type {string} */ x, /** @type {number} */ i) => [x.toLowerCase(), i]),
    );
    const tryAdd = () => {
      const t = index.get(input.value.trim().toLowerCase());
      if (t === undefined) return;
      input.value = "";
      addTag(F, key, t);
      drawChips(key);
      onChange();
    };
    input.addEventListener("change", tryAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryAdd();
    });
  }
  return { drawSuggestions, drawChips, drawAllChips };
}
