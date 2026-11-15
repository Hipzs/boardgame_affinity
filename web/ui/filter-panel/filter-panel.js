// @ts-check
/* Panneau Filtres, source unique pour l'explorateur et « Mes collections » : balisage (markup.js), recherche par
 * mots-clés et champs numériques (anti-rebond), curseurs de note, champs d'étiquettes. Il lit et écrit l'état F
 * (web/lib/filters.js) et prévient la page par `onChange` ; les rubriques propres à une page (Garder / exclure,
 * options, bouton de collection) restent dans la page, sur les ids que ce balisage fournit. */
import { filterPanelHtml } from "./markup.js";
import { createRateSliders } from "./rate-sliders.js";
import { createTagFields } from "./tag-fields.js";
import { setKeywords, NUM_KEYS } from "../../lib/filters.js";

/** Champ de saisie de chaque borne numérique. */
const NUM_INPUT = {
  plMin: "pl-min",
  plMax: "pl-max",
  tMin: "t-min",
  tMax: "t-max",
  ageMax: "age-max",
  wMin: "w-min",
  wMax: "w-max",
};

/**
 * @param {HTMLElement} mount  élément remplacé par le panneau
 * @param {{mode: "explorer" | "collections", D: any, F: any, hideHelp: () => void, onChange: () => void,
 *          suggestions: (key: string) => [number, number][], debounce: number, afterKeywords?: string}} cfg
 *   onChange : une modification de filtre est faite (la page recalcule) ; debounce : ms pour la saisie
 */
export function createFilterPanel(mount, cfg) {
  const { mode, D, F, hideHelp, onChange } = cfg;
  mount.insertAdjacentHTML(
    "afterend",
    filterPanelHtml({ mode, nGames: D.nodes.length, afterKeywords: cfg.afterKeywords }),
  );
  mount.remove();
  const $ = (s) => /** @type {HTMLInputElement} */ (document.querySelector(s));

  const num = (id) => {
    const v = parseFloat($(`#${id}`).value);
    return Number.isFinite(v) ? v : null;
  };
  /** Champs -> état F (mots-clés, bornes numériques) ; renvoie F. */
  function readInputs() {
    setKeywords(F, $("#f-kw").value);
    for (const k of NUM_KEYS) F.nums[k] = num(NUM_INPUT[k]);
    return F;
  }
  /** État F -> champs (restauration, réinitialisation). */
  function writeInputs() {
    $("#f-kw").value = F.kwText;
    for (const k of NUM_KEYS) $(`#${NUM_INPUT[k]}`).value = F.nums[k] ?? "";
  }
  /** @type {any} */ let timer;
  for (const id of ["f-kw", ...Object.values(NUM_INPUT)]) {
    $(`#${id}`).addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, cfg.debounce);
    });
  }

  const rates = createRateSliders(F, { onChange, hideHelp });
  const tags = createTagFields({ D, F, suggestions: cfg.suggestions, onChange, hideHelp });
  tags.drawSuggestions();
  tags.drawAllChips();

  // Poids : désactivé si absent des données.
  if (!D.meta.has_weight) {
    $("#w-min").disabled = $("#w-max").disabled = true;
    $("#weight-row").dataset.help =
      mode === "explorer"
        ? "Poids BGG (complexité, 1–5) : absent du dump actuel, filtre désactivé. Il faut data/raw/weights.csv (API BGG ou autre source), puis relancer src/export_web.py."
        : "Poids BGG (complexité, 1–5) : absent du dump actuel, filtre désactivé.";
  }
  return { readInputs, writeInputs, rates, tags };
}
