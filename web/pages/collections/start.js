/* État de la page mémorisé (sauvegarde / restauration) et démarrage. */
import { deserializeUI, serializeUI, UI_KEY } from "../../lib/ui-persistence.js";
import { $ } from "../../ui/html.js";

export function install(app) {
  const { SORTS, FS, expanded, NUM_IDS, NUM_STATE, readF, COLL } = app;
  Object.assign(app, { saveUI }); // fonctions : disponibles dès le début (hissées)
  // --- Aide au survol (attribut data-help, après 400 ms ; masquée pendant un glisser) : web/ui/help-tooltip.js ---

  // --- État de la page mémorisé (jeu affiché, filtres, surbrillance, tri) -----------------------------------
  // Retrouvé en revenant sur l'onglet, même si la page a été rechargée. localStorage de ce navigateur ; illisible
  // ou absent : la page part de l'état vide.
  function saveUI() {
    readF();
    const st = serializeUI(FS, {
      selected: app.selected,
      expanded,
      showAll: $("#show-all").checked,
      sort: $("#inbox-sort").value,
    });
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(st));
    } catch {
      /* stockage indisponible */
    }
  }
  function loadUI() {
    let st;
    try {
      st = JSON.parse(localStorage.getItem(UI_KEY) || "null");
    } catch {
      st = null;
    }
    const r = deserializeUI(FS, st, { sorts: Object.keys(SORTS), has: (id) => COLL.has(id) });
    if (!r) return;
    for (const k of ["av", "b"]) app.panel.rates.draw(k);
    NUM_IDS.forEach((id, j) => {
      $(`#${id}`).value = FS.nums[NUM_STATE[j]] ?? "";
    });
    $("#f-kw").value = FS.kwText;
    Object.assign(expanded, r.expanded);
    $("#show-all").checked = r.showAll;
    if (r.sort) $("#inbox-sort").value = r.sort;
    app.modeBtns.forEach((b) => b.redraw());
    if (r.selected !== null) app.selected = r.selected; // jeu retiré entre-temps : pas restauré
  }
  loadUI();
  window.addEventListener("pagehide", saveUI);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveUI();
  });

  window.name = "bga-collection"; // les liens « Mes collections » de l'explorateur rouvrent cet onglet
  app.draw();
}
