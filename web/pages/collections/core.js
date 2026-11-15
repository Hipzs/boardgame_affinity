/* Données, état des filtres et prédicat « passe les filtres » : socle commun des vues (créé une fois, passé aux autres modules). */
import { createKeywordText } from "../../lib/keywords.js";
import {
  createFilterState,
  filterCount as filterCountL,
  passes as passesL,
  rateActive as rateActiveL,
  reqBanCount,
} from "../../lib/filters.js";
import { installHelp } from "../../ui/help-tooltip.js";
import { $ } from "../../ui/html.js";

export function createApp() {
  /** Contexte partagé : socle (données, état, calcul) + fonctions que les modules se prêtent. */
  const app = {};
  // Aide au survol (data-help, après 400 ms ; masquée pendant un glisser) : web/ui/help-tooltip.js.
  const { hide: hideHelp } = installHelp({ el: $("#help"), delay: 400, isSuppressed: () => app.dragging });
  const D = window.BGG_DATA,
    COLL = window.BGG_COLLECTION,
    EMO = window.BGG_EMOJI || { themes: {}, families: {} };
  const byId = new Map(D.nodes.map((g) => [g.id, g]));
  const nonThematic = new Set(EMO.nonThematic || []);
  // Émoji du thème dominant : catégorie thématique la plus spécifique (IDF maximal), comme dans l'explorateur.
  const domEmo = (g) => {
    const th = g.c.filter((t) => !nonThematic.has(D.dict.cat[t]));
    const c = (th.length ? th : g.c).reduce((b, t) => (b === null || D.idf.cat[t] > D.idf.cat[b] ? t : b), null);
    return c !== null ? EMO.themes[D.dict.cat[c]] || "" : "";
  };
  const players = (p) => (p[0] && p[1] ? (p[0] === p[1] ? `${p[0]} j.` : `${p[0]}–${p[1]} j.`) : "? j.");
  const SORTS = {
    added: (a, b) => (b.added || "").localeCompare(a.added || ""),
    name: (a, b) => (a.g ? a.g.n : "").localeCompare(b.g ? b.g.n : ""),
    av: (a, b) => (b.g ? b.g.av : 0) - (a.g ? a.g.av : 0),
    y: (a, b) => (b.g ? b.g.y || 0 : 0) - (a.g ? a.g.y || 0 : 0),
    t: (a, b) => (a.g ? a.g.t || 1e9 : 1e9) - (b.g ? b.g.t || 1e9 : 1e9),
  };

  // --- Filtres (1re colonne) : mêmes filtres que l'explorateur (web/app.js), appliqués à mes jeux --------------
  //   Garder / exclure : toutes les étiquettes (mécaniques, thème, familles fines) de mes jeux, par fréquence ;
  //     clic = indispensable (✓), croix au survol = interdite (✕) ; « + » affiche toutes les étiquettes.
  //   Notes BGG et bayésienne : curseurs à deux poignées (glisser la bande déplace l'intervalle).
  //   Joueurs, durée, âge, poids ; famille, auteur, illustrateur, éditeur (au moins un des choix).
  const FAM_SKIP_F = /^(Admin|Crowdfunding|Digital Implementations|Game|Versions & Editions|Misc):/;
  const REQ = {
    m: { dict: "mech", label: "Méca." },
    c: { dict: "cat", label: "Thème" },
    f: { dict: "fam", label: "Familles" },
  };
  const REQ_SHOW = 12; // étiquettes visibles par rubrique avant « + »
  // Filtres : état unique (web/lib/filters.js), alias courts vers ses parties.
  const FS = createFilterState({ reqKeys: ["m", "c", "f"] });
  const { req, ban, tags, notTags, modeReq, modeTag } = FS;
  const expanded = { m: false, c: false, f: false };
  const RATE = FS.rate;
  const rateActive = (k) => rateActiveL(FS, k);
  const NUM_IDS = ["pl-min", "pl-max", "t-min", "t-max", "age-max", "w-min", "w-max"]; // champs numériques (même ordre que FS.nums)
  const NUM_STATE = ["plMin", "plMax", "tMin", "tMax", "ageMax", "wMin", "wMax"];
  const mine = () =>
    COLL.list()
      .map((x) => byId.get(x.id))
      .filter(Boolean);
  const reqTerms = (g, k) => (k === "f" ? g.f.filter((t) => !FAM_SKIP_F.test(D.dict.fam[t])) : g[k]);

  // Recherche par mots-clés (web/lib/keywords.js) ; prédicat unique web/lib/filters.js.
  const kwText = createKeywordText(D);
  const passCtx = { kwText: (g) => kwText(g), terms: (g, i, key) => new Set(g[key]) };
  function readF() {
    app.panel.readInputs();
    const F = { kw: FS.kw };
    NUM_IDS.forEach((id, j) => {
      F[id] = FS.nums[NUM_STATE[j]];
    });
    return F;
  }
  const passes = (g, F) => (g ? passesL(g, 0, FS, passCtx) : !F.active); // jeu absent des données : visible seulement sans filtre
  const nReqBan = () => reqBanCount(FS);
  const filterCount = () => filterCountL(FS, { reqInCount: true });

  Object.assign(app, {
    hideHelp,
    D,
    byId,
    domEmo,
    players,
    SORTS,
    REQ,
    REQ_SHOW,
    FS,
    req,
    ban,
    tags,
    notTags,
    modeReq,
    modeTag,
    expanded,
    RATE,
    rateActive,
    NUM_IDS,
    NUM_STATE,
    mine,
    reqTerms,
    readF,
    passes,
    nReqBan,
    filterCount,
    COLL,
    EMO,
  });
  return app;
}
