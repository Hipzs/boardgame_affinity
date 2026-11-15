/* Données, attributs, signaux, état et calcul des voisins : socle commun des vues (créé une fois, passé aux autres modules). */
import { expand as expandL } from "../../lib/bfs.js";
import { loadDataset } from "../../lib/dataset.js";
import { buildAttrs } from "../../lib/attrs.js";
import { buildEmojiIndex } from "../../lib/emoji-index.js";
import { attrWeights as attrWeightsL, pairDetail as pairDetailL } from "../../lib/metrics.js";
import { buildSignals, inInt as inIntL, SIG_DEFAULT, sigActive as sigActiveL } from "../../lib/signals.js";
import { buildGemQ } from "../../lib/gems.js";
import { createNeighborIndex } from "../../lib/neighbors.js";
import { createFilterState } from "../../lib/filters.js";
import { $, escapeHtml } from "../../ui/html.js";
import { installHelp } from "../../ui/help-tooltip.js";

export function createApp() {
  /** Contexte partagé : socle (données, état, calcul) + fonctions que les modules se prêtent. */
  const app = {};
  const D = window.BGG_DATA;
  const { hide: hideHelp } = installHelp({ el: $("#help"), delay: 300, followFocus: true });
  const N = D.nodes;
  const ds = loadDataset(D);
  const css = getComputedStyle(document.documentElement);
  const depthColor = (d) => css.getPropertyValue(`--d${Math.min(d, 4)}`).trim();

  const { ATTRS, ATTR_KEYS, franchise } = buildAttrs(D);

  // --- Émojis (web/emoji.js) : un par thème, un par famille de mécaniques --------------------------
  const EMO = window.BGG_EMOJI || { themes: {}, families: {} };
  const EI = buildEmojiIndex(D, EMO);
  const { emo, DOM_EMO, NON_THEMATIC } = EI;
  if (EI.missing.mecaniques.length || EI.missing.themes.length) console.warn("emoji.js : sans émoji", EI.missing);
  const emoTag = (key, t) => {
    const e = emo(key, t);
    return e ? `<span class="emo">${e}</span>` : "";
  };

  // --- Métriques (web/lib/metrics.js) ---------------------------------------------------------------

  // --- Signaux par jeu : convoitise et revente (web/lib/signals.js) -------------------------------------
  const BEH = buildSignals(N);
  // Intervalle de centiles [bas, haut] par signal ; [0, 100] = inactif. Par défaut : « Convoité, gardé » (filtre coché).
  const sigInt = { wish: [...SIG_DEFAULT.wish], trade: [...SIG_DEFAULT.trade] };
  const sigActive = (k) => sigActiveL(sigInt, k);
  const inInt = (k, i) => inIntL(BEH, sigInt, k, i);
  // Marquage : point vert (convoitise) / contour rouge (revente) pour les jeux dans l'intervalle actif.
  const markWish = (i) => sigActive("wish") && inInt("wish", i);
  const markTrade = (i) => sigActive("trade") && inInt("trade", i);

  // --- État ---------------------------------------------------------------------------------
  const state = {
    center: -1,
    selected: -1,
    k: 5,
    depth: 2,
    cross: false,
    tau: 0,
    showRating: false,
    colorRating: false,
    // Pondération : un curseur v_k ∈ [0, 100] par attribut, normalisé w_k = v_k / Σ v (au moins un v_k > 0).
    wRaw: { m: 100, c: 0, f: 0, d: 0 },
    metric: "cos",
    signals: true,
    emoji: false,
    gems: true,
    gemBeta: 2, // « Pépites cachées » actif par défaut, intensité β = 2,0
    view: "graph",
    mapSel: "auto",
    famView: false,
    famOpen: null,
    famCenter: "mean",
  };
  // Filtres (web/lib/filters.js) : état unique ; signaux filtrés par défaut (« Convoité, gardé »).
  const FS = createFilterState({ reqKeys: ATTR_KEYS, notTagKeys: [], sigFilter: true });
  // Panneau Filtres : web/ui/filter-panel/ (balisage, curseurs de note, champs d'étiquettes, saisie anti-rebond).
  const attrWeights = () => attrWeightsL(ATTR_KEYS, state.wRaw);
  // Configuration du calcul : métrique, poids par attribut.
  const currentCfg = () => ({ metric: state.metric, w: attrWeights() });
  // Ressemblance d'une paire pour une configuration (infobulles, détails) et sa décomposition par attribut.
  const pairDetail = (u, v, cfg = currentCfg()) => pairDetailL(ATTRS, ATTR_KEYS, u, v, cfg);

  app.pass = new Uint8Array(N.length).fill(1);
  const nbIndex = createNeighborIndex({ N, ATTRS, ATTR_KEYS, franchise, gemQ: buildGemQ(N) });
  // Top-K_MAX voisins de u parmi les jeux qui passent les filtres (en cache tant que les réglages ne changent pas).
  const neighbors = (u, cfg = currentCfg(), gems = state.gems) =>
    nbIndex.neighbors(
      u,
      cfg,
      { gems, gemBeta: state.gemBeta, noFranchise: FS.noFranchise, noReimpl: FS.noReimpl, noExpLine: FS.noExpLine },
      app.pass,
    );

  // --- Recherche du jeu -----------------------------------------------------------------------
  const { label, resolve } = ds;
  const byLabel = new Map(N.map((_, i) => [label(i).toLowerCase(), i]));
  // N est déjà trié par nombre d'avis décroissant (export_web.py).
  $("#games").innerHTML = N.map((_, i) => `<option value="${escapeHtml(label(i))}">`).join("");

  // --- BFS ------------------------------------------------------------------------------------
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  // Parcours en largeur : web/lib/bfs.js (voisins calculés avec les réglages courants).
  const expand = () => expandL(state, (u) => neighbors(u));

  Object.assign(app, {
    D,
    hideHelp,
    N,
    ds,
    depthColor,
    ATTRS,
    ATTR_KEYS,
    franchise,
    EMO,
    DOM_EMO,
    NON_THEMATIC,
    emoTag,
    BEH,
    sigInt,
    sigActive,
    inInt,
    markWish,
    markTrade,
    state,
    FS,
    attrWeights,
    currentCfg,
    pairDetail,
    nbIndex,
    neighbors,
    label,
    resolve,
    byLabel,
    key,
    expand,
  });
  return app;
}
