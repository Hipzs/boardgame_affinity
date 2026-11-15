/* Actions sur les fiches et les collections (clics, retrait, suppression). */

export function install(app) {
  const { hideHelp, COLL } = app;
  Object.assign(app, { wire }); // fonctions : disponibles dès le début (hissées)
  // --- Actions sur les fiches et les collections ------------------------------------------------------
  function wire() {
    app.drawDetail();
    document.querySelectorAll(".gcard [data-rm]").forEach((b) =>
      b.addEventListener("click", () => {
        const card = b.closest(".gcard"),
          id = +card.dataset.id,
          from = card.dataset.from;
        hideHelp();
        if (from) COLL.move(id, from, null);
        else COLL.remove(id);
      }),
    );
    document.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        const c = COLL.collections().find((x) => x.cid === b.dataset.del);
        if (
          c &&
          (!c.games.length ||
            confirm(`Supprimer la collection « ${c.name} » ? Ses ${c.games.length} jeux restent dans tes jeux.`))
        )
          COLL.deleteCollection(c.cid);
      }),
    );
    document.querySelectorAll("[data-ren]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        app.openCollPop(b.dataset.ren, b);
      }),
    );
    document
      .querySelectorAll(".cname")
      .forEach((h) => h.addEventListener("dblclick", () => app.openCollPop(h.dataset.cid, h)));
  }
}
