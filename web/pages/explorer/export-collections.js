/* Mes collections côté explorateur : bouton d'ajout, compteur, export du graphe, mode « Choisir dans le graphe ». */
import { $, escapeHtml } from "../../ui/html.js";

export function install(app) {
  const { hideHelp, N, state } = app;
  Object.assign(app, { collBtn, endPick, togglePick, applyPick }); // fonctions : disponibles dès le début (hissées)
  // --- Mes collections (web/collection-store.js, page collections.html) ---------------------------
  // Bouton dans les détails du jeu cliqué ; le compteur de l'en-tête et le bouton suivent les changements,
  // y compris ceux faits dans l'onglet « Mes collections ».
  const COLL = window.BGG_COLLECTION;
  function collBtn(g) {
    if (!COLL) return "";
    const on = COLL.has(g.id);
    const cs = on ? COLL.collectionsOf(g.id) : [];
    return (
      `<p class="coll-row"><button type="button" id="coll-btn" class="coll-btn${on ? " on" : ""}" aria-pressed="${on}" ` +
      `data-help="${on ? "Ce jeu est dans tes jeux. Clic : le retirer (de toutes les collections)." : "Ajoute ce jeu à tes jeux : il apparaît dans « Nouveaux jeux » de l'onglet « Mes collections », à ranger par glisser-déposer."}">` +
      `${on ? "★ Dans mes collections" : "☆ Ajouter à mes collections"}</button>` +
      (on
        ? `<span class="coll-in">${cs.length ? cs.map((c) => `<span class="ctag${c.color ? " colored" : ""}"${c.color ? ` style="--cc:${c.color}"` : ""}>${escapeHtml(c.name)}</span>`).join("") : '<span class="hint">nouveau jeu, pas encore rangé</span>'}</span>`
        : "") +
      `</p>`
    );
  }
  function drawCollCount() {
    if (!COLL) return;
    const n = COLL.list().length;
    $("#coll-count").textContent = n || "";
  }
  // Export du graphe courant vers Mes collections (bouton à côté de « Liens croisés ») : tous les jeux affichés,
  // vers les nouveaux jeux, une collection existante ou une nouvelle collection.
  const xpop = $("#export-pop");
  function closeExport() {
    xpop.hidden = true;
  }
  function openExport() {
    if (!COLL || !app.current.level) return;
    hideHelp();
    const all = [...app.current.level.keys()];
    const ids = (app.pick ? all.filter((i) => app.pick.sel.has(i)) : all).map((i) => N[i].id);
    const have = new Set(COLL.list().map((x) => x.id));
    const fresh = ids.filter((id) => !have.has(id)).length;
    const colls = COLL.collections();
    const center = N[state.center].n;
    xpop.innerHTML = `
      <div class="xp-head"><p><b>${ids.length} jeu${ids.length > 1 ? "x" : ""}</b> ${app.pick ? `sélectionné${ids.length > 1 ? "s" : ""} sur ${all.length}` : "dans le graphe"} (${fresh} pas encore dans mes jeux)</p>
        <button type="button" class="xp-pick" data-help="Met en surbrillance les nodes du graphe : clic sur un node pour le sélectionner ou le désélectionner, puis « Exporter la sélection ».">${app.pick ? "Modifier la sélection" : "Choisir dans le graphe"}</button></div>
      ${ids.length ? "" : '<p class="hint">Aucun jeu sélectionné.</p>'}
      <button type="button" class="xp-opt" data-to="">Nouveaux jeux <span class="hint">(à ranger)</span></button>
      ${
        colls.length
          ? `<p class="xp-sub">Dans une collection</p>${colls
              .map((c) => {
                const n = ids.filter((id) => !c.games.includes(id)).length;
                return (
                  `<button type="button" class="xp-opt" data-to="${c.cid}"${c.color ? ` style="--cc:${c.color}"` : ""}>` +
                  `<span class="xp-dot${c.color ? " colored" : ""}"></span>${escapeHtml(c.name)} <span class="hint">+${n}</span></button>`
                );
              })
              .join("")}`
          : ""
      }
      <p class="xp-sub">Nouvelle collection</p>
      <form class="xp-new"><input maxlength="60" value="${escapeHtml(`Voisins de ${center}`)}" aria-label="Nom de la nouvelle collection"><button type="submit">Créer</button></form>
      <p class="hint xp-foot">${app.pick ? "Seulement les nodes sélectionnés." : "Jeu choisi et tous ses voisins affichés."} Les jeux déjà présents ne sont pas dupliqués.</p>`;
    xpop.querySelector(".xp-pick").addEventListener("click", () => {
      closeExport();
      startPick();
    });
    if (!ids.length)
      xpop.querySelectorAll(".xp-opt, .xp-new button").forEach((b) => {
        b.disabled = true;
      });
    const done = (r, where) => {
      closeExport();
      endPick();
      $("#search-msg").classList.remove("err");
      $("#search-msg").textContent =
        `${ids.length} jeux exportés vers ${where} : ${r.added} nouveau${r.added > 1 ? "x" : ""} dans mes jeux` +
        (r.inColl !== undefined && where !== "Nouveaux jeux"
          ? `, ${r.inColl} ajouté${r.inColl > 1 ? "s" : ""} à la collection`
          : "") +
        ".";
    };
    xpop.querySelectorAll(".xp-opt").forEach((b) =>
      b.addEventListener("click", () => {
        const cid = b.dataset.to || null;
        const r = COLL.addMany(ids, cid);
        done(r, cid ? `« ${colls.find((c) => c.cid === cid).name} »` : "Nouveaux jeux");
      }),
    );
    xpop.querySelector(".xp-new").addEventListener("submit", (e) => {
      e.preventDefault();
      let name = e.target.querySelector("input").value.trim() || `Voisins de ${center}`;
      const taken = new Set(COLL.collections().map((c) => c.name.toLowerCase()));
      for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${name.replace(/ \(\d+\)$/, "")} (${k})`;
      const cid = COLL.createCollection(name);
      done(COLL.addMany(ids, cid), `« ${name} »`);
    });
    xpop.hidden = false;
    const r = $("#export-btn").getBoundingClientRect(),
      w = $("#graph-wrap").getBoundingClientRect();
    xpop.style.left = `${Math.max(4, r.left - w.left)}px`;
    xpop.style.top = `${r.bottom - w.top + 6}px`;
  }
  // Mode sélection (bouton « Choisir dans le graphe » de l'overlay Exporter) : tous les nodes sont sélectionnés au
  // départ ; un clic (dé)sélectionne un node ; la barre en bas du graphe exporte la sélection. Échap ou Annuler : sortir.
  // Nodes apparus ensuite (voisins, profondeur…) : sélectionnés par défaut.
  app.pick = null; // {sel: Set(index de jeu), seen: Set}
  function startPick() {
    if (state.view !== "graph") app.setView("graph");
    const all = [...app.current.level.keys()];
    app.pick = { sel: new Set(all), seen: new Set(all) };
    applyPick();
  }
  function endPick() {
    if (!app.pick) return;
    app.pick = null;
    applyPick();
  }
  function togglePick(i) {
    if (!app.pick.sel.delete(i)) app.pick.sel.add(i);
    applyPick();
  }
  function applyPick() {
    const bar = $("#pick-bar");
    $("#graph-wrap").classList.toggle("picking", !!app.pick);
    app.gNodes
      .selectAll("g.node")
      .classed("pick-on", (n) => !!app.pick && app.pick.sel.has(n.i))
      .classed("pick-off", (n) => !!app.pick && !app.pick.sel.has(n.i));
    bar.hidden = !app.pick;
    if (!app.pick) return;
    const all = app.current.level ? [...app.current.level.keys()] : [];
    for (const i of all)
      if (!app.pick.seen.has(i)) {
        app.pick.seen.add(i);
        app.pick.sel.add(i);
      }
    const n = all.filter((i) => app.pick.sel.has(i)).length;
    bar.innerHTML =
      `<span><b>${n}</b> / ${all.length} jeux sélectionnés · clic sur un node : (dé)sélectionner</span>` +
      `<button type="button" class="ghost" data-p="all">Tout</button><button type="button" class="ghost" data-p="none">Aucun</button>` +
      `<button type="button" data-p="export"${n ? "" : " disabled"}>Exporter la sélection ⇪</button>` +
      `<button type="button" class="ghost" data-p="cancel">Annuler</button>`;
    bar.querySelector('[data-p="all"]').addEventListener("click", () => {
      all.forEach((i) => app.pick.sel.add(i));
      applyPick();
    });
    bar.querySelector('[data-p="none"]').addEventListener("click", () => {
      app.pick.sel.clear();
      applyPick();
    });
    bar.querySelector('[data-p="export"]').addEventListener("click", (e) => {
      e.stopPropagation();
      openExport();
    });
    bar.querySelector('[data-p="cancel"]').addEventListener("click", endPick);
  }
  ["mousedown", "wheel", "click", "dblclick"].forEach((ev) =>
    $("#pick-bar").addEventListener(ev, (e) => e.stopPropagation()),
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && app.pick && xpop.hidden) endPick();
    },
    true,
  );

  $("#export-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (xpop.hidden) openExport();
    else closeExport();
  });
  document.addEventListener("mousedown", (e) => {
    if (
      !xpop.hidden &&
      !xpop.contains(e.target) &&
      /** @type {Element} */ (e.target).id !== "export-btn" &&
      !(/** @type {Element} */ (e.target).closest("#pick-bar"))
    )
      closeExport();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExport();
  });
  ["mousedown", "wheel", "click", "dblclick"].forEach((ev) => xpop.addEventListener(ev, (e) => e.stopPropagation()));

  if (COLL)
    COLL.onChange(() => {
      drawCollCount();
      hideHelp();
      if (state.selected >= 0) app.select(state.selected);
    });
  drawCollCount();

  Object.assign(app, { COLL });
}
