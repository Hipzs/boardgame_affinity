// @ts-check
/* Mes collections : assemble les modules de la page. `createApp()` construit le socle partagé ; chaque module
 * `install(app)` y branche ses vues et ses écouteurs, dans l'ordre de la page (l'ordre compte au démarrage). */
import { $ } from "../../ui/html.js";
import { createApp } from "./core.js";
import { install as installFilters } from "./filters.js";
import { install as installCards } from "./cards.js";
import { install as installDetail } from "./detail.js";
import { install as installSuggestions } from "./suggestions.js";
import { install as installCardActions } from "./card-actions.js";
import { install as installPopover } from "./collection-popover.js";
import { install as installSections } from "./sections.js";
import { install as installDnd } from "./dnd.js";
import { install as installFromFilters } from "./collection-from-filters.js";
import { install as installActions } from "./actions.js";
import { install as installStart } from "./start.js";

export function startCollections() {
  const w = /** @type {any} */ (window);
  if (!w.BGG_DATA) {
    const msg = /** @type {HTMLElement} */ ($("#coll-msg"));
    msg.textContent = "Données absentes : lancer python3 src/export_web.py.";
    msg.classList.add("err");
    return;
  }
  const app = createApp();
  for (const install of [
    installFilters,
    installCards,
    installDetail,
    installSuggestions,
    installCardActions,
    installPopover,
    installSections,
    installDnd,
    installFromFilters,
    installActions,
    installStart,
  ])
    install(app);
}
