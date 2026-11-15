/* Création, export / import JSON, vidage, synchronisation avec le store. */
import { $ } from "../../ui/html.js";

export function install(app) {
  const { COLL } = app;
  Object.assign(app, { flash }); // fonctions : disponibles dès le début (hissées)
  // --- Création, sauvegarde ------------------------------------------------------------------------------
  $("#new-coll").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#new-coll-name").value.trim();
    if (!name) {
      $("#new-coll-name").focus();
      return;
    }
    if (COLL.collections().some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      flash(`« ${name} » existe déjà.`, true);
      return;
    }
    COLL.createCollection(name);
    $("#new-coll-name").value = "";
  });
  let ft;
  function flash(text, err = false) {
    $("#coll-msg").textContent = text;
    $("#coll-msg").classList.toggle("err", err);
    clearTimeout(ft);
    ft = setTimeout(() => {
      $("#coll-msg").textContent = "";
    }, 4000);
  }
  $("#coll-export").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([COLL.exportJSON()], { type: "application/json" }));
    a.download = `mes_collections_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#coll-import").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const r = COLL.importJSON(await f.text());
      flash(`Importé : ${r.games} jeu(x), ${r.collections} collection(s) nouvelles.`);
    } catch (err) {
      flash(`Import impossible : ${err.message}`, true);
    }
    e.target.value = "";
  });
  $("#coll-clear").addEventListener("click", () => {
    const n = COLL.list().length,
      m = COLL.collections().length;
    if ((n || m) && confirm(`Retirer tes ${n} jeux et tes ${m} collections ?`)) {
      COLL.collections().forEach((c) => COLL.deleteCollection(c.cid));
      COLL.list().forEach((x) => COLL.remove(x.id));
    }
  });
  COLL.onChange(app.draw); // aussi déclenché par les ajouts faits dans l'explorateur (autre onglet)
  $("#inbox-sort").addEventListener("change", app.draw);
  $("#show-all").addEventListener("change", app.draw);
}
