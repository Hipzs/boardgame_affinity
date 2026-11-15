/* Vue carte 2D (t-SNE), centres des thèmes, bascule graphe / carte, mise en évidence. */
import { createCenters } from "../../lib/map-centers.js";
import { $, escapeHtml } from "../../ui/html.js";

export function install(app) {
  const { D, hideHelp, N, depthColor, ATTRS, EMO, NON_THEMATIC, markTrade, state, attrWeights, key } = app;
  Object.assign(app, { drawMap, setView, focusMap, highlight }); // fonctions : disponibles dès le début (hissées)
  // --- Vue carte 2D (coordonnées de src/build_map.py) ------------------------------------------
  const msvg = d3.select("#map");
  const mroot = msvg.append("g");
  const mPts = mroot.append("g");
  const mFamLinks = mroot.append("g").attr("class", "fam-links");
  const mEdges = mroot.append("g");
  const mSel = mroot.append("g");
  const mLabels = mroot.append("g");
  const mFam = mroot.append("g").attr("class", "fam-centroids");
  let mk = 1; // facteur de zoom courant, pour garder des points de taille constante à l'écran
  const mzoom = d3
    .zoom()
    .scaleExtent([0.5, 40])
    .on("zoom", (e) => {
      if (!Number.isFinite(e.transform.k)) return;
      mroot.attr("transform", e.transform);
      mk = e.transform.k;
      mPts.selectAll("circle").attr("r", 2.6 / mk);
      mSel
        .selectAll("circle")
        .attr("r", (n) => (n.d === 0 ? 8 : 5.5) / mk)
        .attr("stroke-width", 1.5 / mk);
      mEdges.selectAll("line").attr("stroke-width", 1.2 / mk);
      mLabels
        .selectAll("text")
        .style("font-size", `${11 / mk}px`)
        .style("stroke-width", `${3 / mk}px`)
        .attr("dx", 7 / mk);
      mFamLinks.selectAll("line").attr("stroke-width", (l) => (l.all ? 0.6 : 1.4) / mk);
      mFam
        .selectAll("circle")
        .attr("r", 14 / mk)
        .attr("stroke-width", 2 / mk);
      mFam.selectAll("text").style("font-size", `${17 / mk}px`);
    });
  msvg.call(mzoom).on("dblclick.zoom", null);
  const onMap = N.map((g, i) => i).filter((i) => N[i].xy);
  let mx = null,
    my = null,
    mapFor = null,
    lastMap = -1;
  const MAP_KEYS = D.meta.map_keys || [];
  // Carte affichée : celle choisie, ou en mode « auto » celle de l'attribut le plus pondéré.
  const mapIdx = () => {
    if (state.mapSel !== "auto") return state.mapSel;
    const w = attrWeights();
    return Math.max(
      0,
      d3.maxIndex(MAP_KEYS, (k) => w[k] ?? -1),
    );
  };
  const P = (i) => N[i].xy[mapIdx()];

  // --- Centres des thèmes, sur chaque carte ----------------------------------------------------------
  // Groupes = thèmes (catégories BGG) réunis par émoji (ex. 🪖 = toutes les guerres modernes), hors catégories
  // de format ou de licence (emoji.js, nonThematic). Un jeu appartient à un groupe s'il en a au moins une
  // catégorie, avec un poids w = (nb de ses catégories thématiques dans le groupe) / (nb total de ses catégories
  // thématiques) : un jeu mono-thème pèse plus qu'un jeu à cinq thèmes. Centre = moyenne pondérée ou pic
  // d'enrichissement, calculé une fois par carte (une par attribut) et mis en cache.
  const CT = createCenters({ D, EMO, NON_THEMATIC });
  const { GROUPS, GAME_FAMS, FAM_MEMBERS } = CT;
  // Deux définitions du centre d'une famille (bouton « Centre ») : moyenne pondérée ou pic d'enrichissement.
  const centers = (mi) => CT.centers(mi, state.famCenter);

  function mapScales() {
    const { width, height } = msvg.node().getBoundingClientRect();
    if (mapFor === `${width}x${height}`) return;
    mapFor = `${width}x${height}`;
    const s = Math.min(width, height) / 2 - 24;
    mx = (v) => width / 2 + s * v;
    my = (v) => height / 2 - s * v;
  }

  function drawMap({ level, links }) {
    mapScales();
    // Changement de carte (autre attribut) : les points glissent vers leur nouvelle place (cartes alignées par Procrustes).
    const m = mapIdx();
    const changed = lastMap >= 0 && m !== lastMap;
    const T = (sel) => (changed ? sel.transition().duration(700) : sel);
    lastMap = m;
    if (changed) focusMap(); // la vue suit le jeu central sur la nouvelle carte
    drawMapAlphaButtons();
    const ptFill = (i) => (state.colorRating ? app.ratingColor(N[i].av) : "var(--d4)");
    mPts
      .selectAll("circle")
      .data(onMap, (i) => i)
      .join("circle")
      .attr("class", (i) => `pt${app.pass[i] ? "" : " out"}`)
      .call((sel) =>
        T(sel)
          .attr("cx", (i) => mx(P(i)[0]))
          .attr("cy", (i) => my(P(i)[1])),
      )
      .attr("r", 2.6 / mk)
      .attr("fill", ptFill)
      .on("mouseenter", (e, i) => app.tipShow(app.nodeTip(i, level.has(i) ? level.get(i) : null), e))
      .on("mousemove", app.tipMove)
      .on("mouseleave", app.tipHide)
      .on("click", (e, i) => {
        e.stopPropagation();
        app.select(i);
      })
      .on("dblclick", (e, i) => {
        e.stopPropagation();
        app.setCenter(i);
      });

    // Jeux du graphe courant : liens de l'arbre puis points mis en avant (couleur du niveau ou de la note).
    const tree = links.filter((l) => !l.cross && N[l.source].xy && N[l.target].xy);
    mEdges
      .selectAll("line")
      .data(tree, (l) => key(l.source, l.target))
      .join("line")
      .attr("class", "edge")
      .call((sel) =>
        T(sel)
          .attr("x1", (l) => mx(P(l.source)[0]))
          .attr("y1", (l) => my(P(l.source)[1]))
          .attr("x2", (l) => mx(P(l.target)[0]))
          .attr("y2", (l) => my(P(l.target)[1])),
      )
      .attr("stroke-width", 1.2 / mk);
    const sel = [...level.keys()].filter((i) => N[i].xy).map((i) => ({ i, d: level.get(i) }));
    mSel
      .selectAll("circle")
      .data(sel, (n) => n.i)
      .join("circle")
      .attr("class", "pt in")
      .call((sel) =>
        T(sel)
          .attr("cx", (n) => mx(P(n.i)[0]))
          .attr("cy", (n) => my(P(n.i)[1])),
      )
      .attr("r", (n) => (n.d === 0 ? 8 : 5.5) / mk)
      .attr("stroke-width", 1.5 / mk)
      .attr("fill", (n) => (state.colorRating ? app.ratingColor(N[n.i].av) : depthColor(n.d)))
      .style("stroke", (n) => (state.signals && markTrade(n.i) ? "var(--sig-trade)" : null))
      .on("mouseenter", (e, n) => app.tipShow(app.nodeTip(n.i, n.d), e))
      .on("mousemove", app.tipMove)
      .on("mouseleave", app.tipHide)
      .on("click", (e, n) => {
        e.stopPropagation();
        app.select(n.i);
      })
      .on("dblclick", (e, n) => {
        e.stopPropagation();
        app.setCenter(n.i);
      });
    mLabels
      .selectAll("text")
      .data(
        sel.filter((n) => n.d <= 1),
        (n) => n.i,
      )
      .join("text")
      .call((sel) =>
        T(sel)
          .attr("x", (n) => mx(P(n.i)[0]))
          .attr("y", (n) => my(P(n.i)[1])),
      )
      .attr("dx", 7 / mk)
      .attr("dy", "0.32em")
      .style("font-size", `${11 / mk}px`)
      .style("stroke-width", `${3 / mk}px`)
      .text((n) => app.gameName(n.i));
    drawFamilies(level, T);
  }

  // Centres des thèmes (émoji au centre) et liens vers les jeux : jeux du graphe courant toujours ; tous les
  // membres du thème ouvert (clic sur son émoji).
  function drawFamilies(level, T) {
    $("#fam-btn").setAttribute("aria-pressed", state.famView);
    if (!state.famView) {
      $("#fam-center").hidden = true;
      mFam.selectAll("*").remove();
      mFamLinks.selectAll("*").remove();
      return;
    }
    const C = centers(mapIdx());
    $("#fam-center").hidden = false;
    $("#fam-center").textContent = state.famCenter === "peak" ? "Centre : pic" : "Centre : moyenne";
    const cents = Object.values(C);
    const links = [];
    for (const i of level.keys()) {
      if (!N[i].xy) continue;
      for (const f of GAME_FAMS[i].keys()) if (C[f]) links.push({ f, i, all: false });
    }
    if (state.famOpen && C[state.famOpen]) {
      const inGraph = new Set(level.keys());
      for (const i of FAM_MEMBERS[state.famOpen]) if (!inGraph.has(i)) links.push({ f: state.famOpen, i, all: true });
    }
    mFamLinks
      .selectAll("line")
      .data(links, (l) => `${l.f}|${l.i}|${l.all}`)
      .join("line")
      .attr("class", (l) => `fam-link${l.all ? " all" : ""}${state.famOpen === l.f ? " open" : ""}`)
      .attr("stroke-width", (l) => (l.all ? 0.6 : 1.4) / mk)
      .call((sel) =>
        T(sel)
          .attr("x1", (l) => mx(C[l.f].x))
          .attr("y1", (l) => my(C[l.f].y))
          .attr("x2", (l) => mx(P(l.i)[0]))
          .attr("y2", (l) => my(P(l.i)[1])),
      );
    const g = mFam
      .selectAll("g.fam")
      .data(cents, (c) => c.f)
      .join((enter) => {
        const e = enter.append("g").attr("class", "fam");
        e.append("circle");
        e.append("text").attr("text-anchor", "middle").attr("dy", "0.35em");
        return e;
      })
      .classed("open", (c) => state.famOpen === c.f)
      .classed("dim", (c) => state.famOpen && state.famOpen !== c.f);
    g.call((sel) => T(sel).attr("transform", (c) => `translate(${mx(c.x)},${my(c.y)})`));
    g.select("circle")
      .attr("r", 14 / mk)
      .attr("stroke-width", 2 / mk);
    g.select("text")
      .style("font-size", `${17 / mk}px`)
      .text((c) => GROUPS[c.f].emoji);
    g.on("mouseenter", (e, c) => {
      const F = GROUPS[c.f];
      const inG = [...level.keys()].filter((i) => GAME_FAMS[i].has(c.f)).length;
      app.tipShow(
        `<b>${F.emoji} ${escapeHtml(F.label)}</b><span class="tl">${c.n} jeux de la carte · ${inG} dans le graphe · ` +
          `dispersion ${c.spread.toFixed(2)}${c.lift ? ` · sur-représentation ×${c.lift.toFixed(1)} au pic` : ""}</span><span class="ds">${escapeHtml(F.cats.join(", "))}</span>` +
          `<span class="tl">Clic : ${state.famOpen === c.f ? "masquer" : "afficher"} les liens vers tous ses jeux.</span>`,
        e,
      );
    })
      .on("mousemove", app.tipMove)
      .on("mouseleave", app.tipHide)
      .on("click", (e, c) => {
        e.stopPropagation();
        state.famOpen = state.famOpen === c.f ? null : c.f;
        app.tipHide();
        app.render();
      });
  }

  function setView(v) {
    if (v === "map" && !D.meta.map_method) {
      $("#map-msg").textContent = "Carte absente : lancer python3 src/build_map.py puis src/export_web.py.";
      return;
    }
    if (v !== "graph" && app.pick) app.endPick(); // la sélection ne se fait que sur le graphe
    state.view = v;
    document.querySelectorAll(".view-btn").forEach((b) => {
      b.classList.toggle("on", /** @type {HTMLElement} */ (b).dataset.view === v);
      b.setAttribute("aria-pressed", String(/** @type {HTMLElement} */ (b).dataset.view === v));
    });
    // Sur un <app.svg>, la propriété .hidden n'existe pas (simple expando) : on manipule l'attribut.
    $("#graph").toggleAttribute("hidden", v !== "graph");
    $("#map").toggleAttribute("hidden", v !== "map");
    $("#map-alpha-row").hidden = v !== "map";
    $("#fam-btn").hidden = v !== "map";
    // la note écrite et les liens croisés n'existent que sur le graphe
    $("#show-rating").hidden = $("#cross").hidden = v !== "graph";
    mapFor = null; // tailles à recalculer une fois la vue affichée
    app.tipHide();
    if (state.center >= 0) app.render();
    if (v === "map") focusMap();
  }
  // Boutons de choix de la carte : Auto (attribut le plus pondéré) ou la carte d'un attribut seul.
  function drawMapAlphaButtons() {
    const m = mapIdx();
    const opts = [
      ["auto", "Auto", "La carte suit les curseurs : on affiche la carte de l'attribut le plus pondéré."],
    ].concat(
      MAP_KEYS.map((k, j) => [
        j,
        ATTRS[k].short,
        `Carte t-SNE calculée avec « ${ATTRS[k].label} » seul (100 %), cosinus IDF.`,
      ]),
    );
    $("#map-alpha-row").innerHTML = opts
      .map(([v, lab, help]) => {
        const on = state.mapSel === v || (state.mapSel === "auto" && v === m);
        return (
          `<button type="button" class="view-btn${on ? " on" : ""}${v === "auto" && state.mapSel === "auto" ? " on" : ""}" ` +
          `data-ma="${v}" data-help="${escapeHtml(help)}">${lab}</button>`
        );
      })
      .join("");
    $("#map-alpha-row")
      .querySelectorAll("button")
      .forEach((b) =>
        b.addEventListener("click", () => {
          state.mapSel = b.dataset.ma === "auto" ? "auto" : +b.dataset.ma;
          hideHelp();
          app.render();
        }),
      );
  }
  // Recadre la carte sur le jeu central (zoom ×3), en douceur.
  function focusMap() {
    const g = N[state.center];
    if (!g || !g.xy) return;
    mapScales();
    const xy = P(state.center);
    const { width, height } = msvg.node().getBoundingClientRect();
    const k = Math.max(mk, 3);
    msvg
      .transition()
      .duration(500)
      .call(
        mzoom.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(k)
          .translate(-mx(xy[0]), -my(xy[1])),
      );
  }

  function highlight(i, lk) {
    if (i < 0) {
      app.gNodes.selectAll("g.node").classed("dim", false);
      app.gLinks.selectAll("line").classed("dim", false);
      return;
    }
    const near = new Set([i]);
    lk.forEach((l) => {
      if (l.source.i === i) near.add(l.target.i);
      if (l.target.i === i) near.add(l.source.i);
    });
    app.gNodes.selectAll("g.node").classed("dim", (n) => !near.has(n.i));
    app.gLinks.selectAll("line").classed("dim", (l) => l.source.i !== i && l.target.i !== i);
  }

  Object.assign(app, { msvg });
}
