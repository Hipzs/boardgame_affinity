// @ts-check
/* Explorateur : assemble les modules de la page. `createApp()` construit le socle partagé (A) ; chaque module
 * `install(A)` y branche ses vues et ses écouteurs, dans l'ordre de la page (l'ordre compte au démarrage). */
import { $ } from "../../ui/html.js";
import { createApp } from "./core.js";
import { install as installFilters } from "./filters.js";
import { install as installGraph } from "./graph-view.js";
import { install as installMap } from "./map-view.js";
import { install as installDetails } from "./details.js";
import { install as installExport } from "./export-collections.js";
import { install as installToolbar } from "./toolbar.js";
import { install as installSignals } from "./signals-ui.js";
import { install as installWeights } from "./weights-ui.js";
import { install as installActiveFilters } from "./active-filters-pop.js";
import { install as installAgreement } from "./agreement-view.js";
import { install as installShare } from "./share-link.js";
import { install as installStart } from "./start.js";

export function startExplorer() {
  const w = /** @type {any} */ (window);
  if (!w.BGG_DATA || !w.d3) {
    const msg = /** @type {HTMLElement} */ ($("#search-msg"));
    msg.textContent = !w.BGG_DATA
      ? "Données absentes : lancer python3 src/export_web.py."
      : "d3 n'a pas pu être chargé (connexion internet requise pour le CDN).";
    msg.classList.add("err");
    return;
  }
  const app = createApp();
  for (const install of [
    installFilters,
    installGraph,
    installMap,
    installDetails,
    installExport,
    installToolbar,
    installSignals,
    installWeights,
    installActiveFilters,
    installAgreement,
    installShare,
    installStart,
  ])
    install(app);
}
