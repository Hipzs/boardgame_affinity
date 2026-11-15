/* Nouvelle collection à partir des filtres actifs. */
import { $ } from "../../ui/html.js";

export function install(app) {
  const { COLL } = app;
  // --- Nouvelle collection à partir des filtres actifs ------------------------------------------------------
  // Tous mes jeux qui passent les filtres (nouveaux jeux et collections confondus) ; ils restent aussi là où ils sont.
  // Nom proposé : les filtres actifs, en abrégé (modifiable).
  app.filteredIds = [];
  function filterName() {
    const parts = app
      .activeFilters()
      .map((x) => x.text.replace(/ \((Méca\.|Thème|Familles)(, OU)?\)$/, (m0, a, o) => (o ? " (OU)" : "")));
    let name = parts.join(", ");
    if (name.length > 56) name = `${name.slice(0, 55).replace(/[ ,]+[^ ,]*$/, "")}…`;
    return name || "Sélection filtrée";
  }
  $("#f-save-btn").addEventListener("click", () => {
    const f = $("#f-save-form");
    f.hidden = !f.hidden;
    if (!f.hidden) {
      $("#f-save-name").value = filterName();
      $("#f-save-name").focus();
      $("#f-save-name").select();
    }
  });
  $("#f-save-form").addEventListener("submit", (e) => {
    e.preventDefault();
    let name = $("#f-save-name").value.trim() || filterName();
    const taken = new Set(COLL.collections().map((c) => c.name.toLowerCase()));
    for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${name.replace(/ \(\d+\)$/, "")} (${k})`;
    const ids = app.filteredIds.slice();
    const cid = COLL.createCollection(name);
    COLL.addMany(ids, cid);
    $("#f-save-form").hidden = true;
    app.flash(`Collection « ${name} » créée avec ${ids.length} jeu${ids.length > 1 ? "x" : ""}.`);
  });
  $("#f-save-name").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      $("#f-save-form").hidden = true;
    }
  });
}
