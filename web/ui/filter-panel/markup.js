// @ts-check
/* Balisage du panneau Filtres, commun à l'explorateur et à « Mes collections » (les ids sont ceux que lisent le CSS
 * et les tests : ne pas les changer). Les différences entre pages tiennent à `cfg.mode` ; les textes d'aide sont ici. */

/** @typedef {{mode: "explorer" | "collections", nGames: number, afterKeywords?: string}} PanelMarkupConfig */

/** @type {[string, string, string, string][]} */
const RATE_LINES = [
  [
    "av",
    "Note BGG",
    "Note BGG moyenne des joueurs (sur 10) : garde les jeux dont la note est dans l'intervalle.",
    "Note BGG",
  ],
  [
    "b",
    "Note bayés.",
    "Note bayésienne BGG (« Geek Rating ») : moyenne tirée vers 5,5 tant que le jeu a peu d'avis ; sert au classement BGG. Garde les jeux dont la note est dans l'intervalle.",
    "Note bayésienne",
  ],
];
const rateLine = ([k, name, help, aria]) => `
<div class="sig-line rate-line" data-help="${help}">
  <span class="sig-name">${name}</span><output id="${k}-out"></output>
  <div class="dual range2 rate" id="${k}-int">
    <input id="${k}-lo" type="range" aria-label="${aria} minimale">
    <input id="${k}-hi" type="range" aria-label="${aria} maximale">
  </div>
</div>`;

const RANGES = `
<div class="range" data-help="Garde les jeux jouables pour au moins un nombre de joueurs de l'intervalle (ex. 2 à 2 : jouables à deux). Nombre inconnu : exclu.">
  <span class="rl">Joueurs</span>
  <input id="pl-min" type="number" min="1" max="20" placeholder="de"> –
  <input id="pl-max" type="number" min="1" max="20" placeholder="à">
</div>
<div class="range" data-help="Durée de partie annoncée, en minutes. Durée inconnue : exclu.">
  <span class="rl">Durée (min)</span>
  <input id="t-min" type="number" min="0" step="5" placeholder="de"> –
  <input id="t-max" type="number" min="0" step="5" placeholder="à">
</div>
<div class="range" data-help="Âge du plus jeune joueur : garde les jeux dont l'âge minimal est inférieur ou égal. Âge inconnu : exclu.">
  <span class="rl">Âge ≤</span>
  <input id="age-max" type="number" min="0" max="21" placeholder="âge">
</div>
<div class="range" id="weight-row" data-help="Poids BGG (complexité, de 1 à 5).">
  <span class="rl">Poids (1–5)</span>
  <input id="w-min" type="number" min="1" max="5" step="0.1" placeholder="de"> –
  <input id="w-max" type="number" min="1" max="5" step="0.1" placeholder="à">
</div>`;

/** @type {[string, string, string, string, string][]} */
const TAG_FIELDS = [
  [
    "f",
    "Famille",
    "ex. Theme: Space Exploration",
    "familles",
    "d'au moins une des familles choisies (thème, série, composants…). Plusieurs champs remplis : tous doivent correspondre.",
  ],
  ["d", "Auteur", "ex. Reiner Knizia", "auteurs", "d'au moins un des auteurs choisis."],
  ["ar", "Illustrateur", "ex. Michael Menzel", "illustrateurs", "d'au moins un des illustrateurs choisis."],
  ["pu", "Éditeur", "ex. Days of Wonder", "éditeurs", "d'au moins un des éditeurs choisis."],
];
const tagField = (
  /** @type {string} */ mode,
  /** @type {[string, string, string, string, string]} */ [k, label, ph, plural, helpExplorer],
) => {
  const help =
    mode === "explorer"
      ? `Garde les jeux ${helpExplorer}`
      : `Garde les jeux qui ont les ${plural} choisis : au moins un (OU) ou tous (ET), selon la petite étiquette à côté du titre.`;
  return `
<div class="tagfilter" data-key="${k}" data-help="${help}">
  <label for="tf-${k}">${label}</label>
  <input id="tf-${k}" list="dl-${k}" placeholder="${ph}">
  <datalist id="dl-${k}"></datalist>
  <div class="chips"></div>
</div>`;
};

const KW_HELP = {
  explorer: (n) =>
    `Recherche par mots-clés dans les ${n} jeux : nom, description (début et mots-clés), mécaniques, catégories, familles, auteurs, illustrateurs, éditeurs, extensions, année. Plusieurs mots : le jeu doit tous les contenir (accents et majuscules ignorés, données en anglais). Préfixe « - » pour exclure un mot (ex. -dice). Les voisins sont cherchés parmi les jeux qui correspondent ; le jeu choisi reste affiché.`,
  collections: () =>
    `Recherche par mots-clés dans tous tes jeux : nom, description (début et mots-clés), mécaniques, thèmes, familles, auteurs, illustrateurs, éditeurs, extensions, année. Plusieurs mots : le jeu doit tous les contenir (accents et majuscules ignorés). Préfixe « - » pour exclure un mot (ex. -dice).`,
};
const KW_ARIA = { explorer: "Recherche par mots-clés", collections: "Recherche par mots-clés dans mes jeux" };

const RESET = `<button id="reset" type="button" class="secondary" data-help="Vide tous les filtres, sauf « Garder / exclure » (bouton « Effacer » dédié).">Réinitialiser</button>`;
const kwSearch = (/** @type {PanelMarkupConfig} */ c) => `
<div class="kw-search" data-help="${KW_HELP[c.mode](c.nGames)}">
  <input id="f-kw" type="search" placeholder="Mots-clés : nom, description, mécanique, auteur…" autocomplete="off" aria-label="${KW_ARIA[c.mode]}">
</div>`;

const REQ_CLEAR = `<button id="req-clear" type="button" class="secondary" data-help="Remet toutes les mécaniques et catégories à l'état neutre.">Effacer</button>`;
const REQ_EXPLORER = `
<div class="required in-filters">
  <h2 data-help="Étiquettes du jeu central (mécaniques, thème, familles fines, mots-clés de la description). Clic sur une étiquette : indispensable (✓, chaque voisin doit l'avoir), nouveau clic : neutre. Croix à droite (au survol) : interdite (✕, aucun voisin ne doit l'avoir). Conservé quand tu recentres." class="req-title"><span id="req-count" class="badge"></span></h2>
  <h3>Mécaniques</h3>
  <div id="req-m" class="chips"></div>
  <h3>Thème</h3>
  <div id="req-c" class="chips"></div>
  <h3 data-help="Les 16 familles BGG les plus caractéristiques du jeu central (hors Admin:, Crowdfunding:, Game:…).">Familles fines</h3>
  <div id="req-f" class="chips"></div>
  <h3 data-help="Les 14 mots les plus caractéristiques de la description du jeu central (TF-IDF, titre retiré). « Indispensable » : le mot doit être parmi les 40 mots-clés du voisin.">Description (mots-clés)</h3>
  <div id="req-d" class="chips"></div>
  ${REQ_CLEAR}
</div>`;
const REQ_COLLECTIONS = `
<div class="required in-filters">
  <h2 data-help="Étiquettes de tes jeux (mécaniques, thème, familles fines), des plus fréquentes aux plus rares ; « + » : les afficher toutes. Clic sur une étiquette : indispensable (✓, le jeu doit l'avoir), nouveau clic : neutre. Croix à droite (au survol) : interdite (✕, le jeu ne doit pas l'avoir). Non vidé par « Réinitialiser » (bouton « Effacer »)." class="req-title"><span id="req-count" class="badge"></span></h2>
  <details class="req-sec" data-sec="m" open><summary><h3>Mécaniques <span class="sec-n" id="sec-n-m"></span></h3></summary>
    <div id="req-m" class="chips"></div></details>
  <details class="req-sec" data-sec="c" open><summary><h3>Thème <span class="sec-n" id="sec-n-c"></span></h3></summary>
    <div id="req-c" class="chips"></div></details>
  <details class="req-sec" data-sec="f" open><summary><h3 data-help="Familles BGG de tes jeux (hors Admin:, Crowdfunding:, Game:…).">Familles fines <span class="sec-n" id="sec-n-f"></span></h3></summary>
    <div id="req-f" class="chips"></div></details>
  ${REQ_CLEAR}
</div>`;

const OPTIONS = `
<div class="options in-filters">
  <h2>Options</h2>
  <div class="opt-btns">
    <button type="button" class="fam-toggle" id="no-reimpl" aria-pressed="false" data-help="Écarte les réimplémentations (nouvelles versions des mêmes règles selon BGG, ex. Pandemic → Iberia, Reign of Cthulhu, WoW: Wrath of the Lich King) du jeu dont on part. Groupes : composantes connexes des liens BGG.">Sans réimpl.</button>
    <button type="button" class="fam-toggle" id="no-franchise" aria-pressed="false" data-help="Écarte les voisins qui partagent une famille « Game: … » (même franchise, ex. Pandemic: X) avec le jeu dont on part.">Sans franchise</button>
    <button type="button" class="fam-toggle" id="no-expline" aria-pressed="false" data-help="Écarte les jeux de la même gamme compatible que le jeu dont on part : jeux qui partagent une extension officielle BGG dont le nom commence par leur titre (ex. Dominion, Dominion: Intrigue et Dominion (Second Edition) ; Evolution et Evolution: Climate ; les boîtes D&amp;D Adventure System). Les extensions elles-mêmes ne sont pas dans les données (seulement les jeux de base) : 230 jeux concernés, en 81 gammes.">Sans extension</button>
    <button type="button" class="fam-toggle" id="emoji" aria-pressed="false" data-help="Ajoute devant le nom de chaque jeu, sur le graphe et la carte, l'émoji de son thème dominant (sa catégorie BGG la plus spécifique). Les émojis des étiquettes restent toujours affichés dans les pastilles.">Émojis</button>
  </div>
</div>`;

/** Contenu du panneau Filtres pour la page demandée (chaîne HTML statique : aucune donnée utilisateur). */
export function filterPanelHtml(/** @type {PanelMarkupConfig} */ cfg) {
  const body = (req) =>
    `${req}${RATE_LINES.map(rateLine).join("")}${RANGES}${TAG_FIELDS.map((t) => tagField(cfg.mode, t)).join("")}`;
  if (cfg.mode === "explorer")
    return `<details class="filters" open>
<summary id="filters-sum">Filtres <span id="filter-count" class="badge"></span></summary>
${RESET}${kwSearch(cfg)}${body(REQ_EXPLORER)}
${OPTIONS}
</details>`;
  return `${RESET}${kwSearch(cfg)}${cfg.afterKeywords ?? ""}
<div class="filters">
<h2 id="filters-sum" class="filters-title">Filtres <span id="filter-count" class="badge"></span></h2>
${body(REQ_COLLECTIONS)}
</div>`;
}
