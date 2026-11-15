/* Fiches de jeu, listes « Nouveaux jeux » et collections (dessin de la page). */
import { $, escapeHtml as esc } from "../../ui/html.js";

export function install(app) {
  const { D, byId, domEmo, players, SORTS, readF, passes, filterCount, COLL } = app;
  Object.assign(app, { syncSide, draw }); // fonctions : disponibles dès le début (hissées)
  // --- Étiquettes du jeu affiché <-> filtres de gauche ---------------------------------------------------------
  // Un clic sur une étiquette du jeu affiché active ou retire le filtre correspondant à gauche (orange des deux
  // côtés) ; un clic sur ce filtre à gauche le retire des deux côtés. (Remplace l'ancienne surbrillance.)
  const HL_NAMES = {
    m: ["mech", "Méca."],
    c: ["cat", "Thème"],
    d: ["des", "Auteur"],
    pu: ["pub", "Éditeur"],
    f: ["fam", "Famille"],
  };
  let saveT = null;
  const queueSave = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => app.saveUI(), 300);
  };
  function syncSide() {
    queueSave();
  }

  // Fiche compacte d'un jeu, déplaçable. from = collection d'origine ("" = nouveaux jeux).
  function gcard(id, from, extra = "") {
    const g = byId.get(id);
    if (!g) {
      return (
        `<div class="gcard missing" draggable="true" data-id="${id}" data-from="${from}">` +
        `<span class="gname">Jeu ${id} (absent des données)</span>${rmBtn(from)}</div>`
      );
    }
    const mech = g.m
      .map((t) => D.dict.mech[t])
      .sort()
      .join(", ");
    const help =
      `${g.n}${g.y ? ` (${g.y})` : ""} · ★ ${g.av.toFixed(2)} · ${players(g.p)} · ${g.t ? `${g.t} min` : "durée ?"}` +
      `${g.a ? ` · ${g.a} ans et +` : ""}. Mécaniques : ${mech || "aucune"}. ${g.ds || ""}`;
    return (
      `<div class="gcard" draggable="true" data-id="${id}" data-from="${from}" data-help="${esc(help)}">` +
      `<span class="gname"><span class="emo">${domEmo(g)}</span> ${esc(g.n)}${g.y ? ` <span class="yr">${g.y}</span>` : ""}</span>` +
      `<span class="gmeta">★ ${g.av.toFixed(1)} · ${players(g.p)} · ${g.t ? `${g.t} min` : "?"}</span>${extra}` +
      `<span class="gact">` +
      `<a href="index.html#${id}" target="bga-explorer" title="Ouvrir dans l'explorateur" draggable="false">↗</a>` +
      `<a href="https://boardgamegeek.com/boardgame/${id}" target="_blank" rel="noopener" title="Fiche BGG" draggable="false">BGG</a>` +
      `${rmBtn(from)}</span></div>`
    );
  }
  const rmBtn = (from) =>
    `<button type="button" class="grm" data-rm title="${from ? "Retirer de cette collection" : "Retirer de mes jeux (et de toutes les collections)"}">✕</button>`;

  function draw() {
    const games = COLL.list(),
      colls = COLL.collections();
    $("#coll-count").textContent = games.length || "";
    // --- gauche ---
    const all = $("#show-all").checked;
    const F = readF();
    F.active = filterCount(F) > 0;
    $("#filter-count").textContent = filterCount(F) || "";
    const ok = (id) => passes(byId.get(id), F);
    const src = all ? games : COLL.inbox();
    const items = src
      .map((x) => ({ id: x.id, added: x.added, g: byId.get(x.id) }))
      .filter((x) => ok(x.id))
      .sort(SORTS[$("#inbox-sort").value] || SORTS.added);
    app.filteredIds = games.filter((x) => ok(x.id)).map((x) => x.id);
    const shown = app.filteredIds.length;
    $("#f-stats").textContent = F.active
      ? `${shown} / ${games.length} de tes jeux passent les filtres`
      : `${games.length} jeu${games.length > 1 ? "x" : ""} au total`;
    // Bouton « Collection avec ces jeux » : seulement avec au moins un filtre actif et un jeu qui passe.
    $("#f-save").hidden = !(F.active && shown);
    $("#f-save-btn").textContent = `＋ Collection avec ces ${shown} jeu${shown > 1 ? "x" : ""}`;
    app.drawRequired();
    app.drawTagFilters();
    if (!app.fpop.hidden) app.drawFilterPop();
    if (typeof app.saveUI === "function") queueSave();
    $("#inbox-count").textContent = COLL.inbox().length || "";
    $("#inbox").innerHTML =
      items
        .map((x) => {
          const cs = all ? COLL.collectionsOf(x.id).map(app.ctag).join("") : "";
          return gcard(x.id, "", cs ? `<span class="ctags">${cs}</span>` : "");
        })
        .join("") ||
      `<p class="hint empty">${
        games.length
          ? F.active
            ? "Aucun nouveau jeu ne passe les filtres."
            : "Tous tes jeux sont rangés. Ajoute-en depuis l'explorateur."
          : "Aucun jeu pour l'instant. Dans l'explorateur, clique sur un jeu puis sur « ☆ Ajouter à mes collections » (colonne de droite)."
      }</p>`;
    // --- droite ---
    $("#colls-count").textContent = colls.length || "";
    $("#colls").innerHTML =
      colls
        .map((c) => {
          const ids = [...c.games]
            .filter(ok)
            .sort((a, b) => (byId.get(a)?.n || "").localeCompare(byId.get(b)?.n || ""));
          return `<article class="coll-box dropzone${c.color ? " colored" : ""}" data-drop="${c.cid}"${c.color ? ` style="--cc:${c.color}"` : ""}>
        <div class="coll-head" draggable="true" data-cid="${c.cid}" title="Glisser l'en-tête pour réordonner les collections">
          <span class="cgrip" aria-hidden="true">⠿</span>
          <h3 class="cname" data-cid="${c.cid}" title="Double-clic : renommer ou changer la couleur">${c.color ? '<span class="cdot"></span>' : ""}${esc(c.name)}</h3>
          <span class="badge">${F.active && ids.length !== c.games.length ? `${ids.length} / ${c.games.length}` : c.games.length || ""}</span>
          <button type="button" class="cbtn" data-sugg="${c.cid}" title="Suggestions : jeux proches du profil de cette collection">💡</button>
          <button type="button" class="cbtn" data-ren="${c.cid}" title="Renommer, couleur">✎</button>
          <button type="button" class="cbtn" data-del="${c.cid}" title="Supprimer la collection">🗑</button>
        </div>
        <div class="gamelist">${ids.map((id) => gcard(id, c.cid)).join("") || `<p class="hint empty">${c.games.length ? "Aucun jeu ne passe les filtres." : "Glisse des jeux ici."}</p>`}</div>
      </article>`;
        })
        .join("") ||
      `<p class="hint empty">Aucune collection. Crée-en une ci-dessus (ex. « Coopératifs », « Soirées à 2 »), puis glisse des jeux dedans.</p>`;
    app.wire();
  }

  Object.assign(app, { HL_NAMES });
}
