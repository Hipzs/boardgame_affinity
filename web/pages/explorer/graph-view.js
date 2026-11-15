/* Vue graphe : rendu SVG d3 (nœuds, liens, zoom), infobulles, ligne de rendu. */
import { BUDGET, MAX_NODES, worst } from "../../lib/bfs.js";
import { METRICS } from "../../lib/metrics.js";
import { $, escapeHtml } from "../../ui/html.js";

export function install(app) {
  const {
    N,
    depthColor,
    ATTRS,
    ATTR_KEYS,
    DOM_EMO,
    BEH,
    markWish,
    markTrade,
    state,
    attrWeights,
    pairDetail,
    label,
    key,
    expand,
  } = app;
  Object.assign(app, { tipShow, tipHide, breakdown, nodeTip, render }); // fonctions : disponibles dès le début (hissées)
  // --- Rendu SVG ----------------------------------------------------------------------------
  const svg = d3.select("#graph");
  const root = svg.append("g");
  const gLinks = root.append("g");
  const gHits = root.append("g");
  const gNodes = root.append("g");
  const zoom = d3
    .zoom()
    .scaleExtent([0.2, 5])
    .on("zoom", (e) => root.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  const tip = $("#tooltip");
  // Nom affiché sur le graphe et la carte : précédé de l'émoji du thème dominant si la case « Émojis » est cochée.
  const gameName = (i) => (state.emoji && DOM_EMO[i] ? `${DOM_EMO[i]} ${N[i].n}` : N[i].n);
  let sim = null;
  app.current = { parent: new Map() };

  // ∝ log(nombre d'avis) ; rayon minimal de 11 px quand la note est écrite dans la bulle.
  const radius = (i) => {
    const r = 4 + 2.2 * Math.log10(Math.max(N[i].r, 10));
    return state.showRating ? Math.max(r, 11) : r;
  };
  // Note moyenne BGG -> couleur (viridis, saturée en dehors de [5,5 ; 8,5]).
  const ratingColor = d3.scaleSequential(d3.interpolateViridis).domain([5.5, 8.5]).clamp(true);
  // Texte noir ou blanc selon la luminance du fond.
  const textOn = (bg) => {
    const c = d3.rgb(bg);
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 140 ? "#111" : "#fff";
  };

  // --- Infobulles -------------------------------------------------------------------------------
  function tipShow(html, e) {
    tip.innerHTML = html;
    tip.hidden = false;
    tipMove(e);
  }
  // Place une infobulle près du pointeur, dans la zone du graphe (bascule à gauche / au-dessus près des bords).
  function placeTip(el, e) {
    const r = $("#graph-wrap").getBoundingClientRect();
    const x = e.clientX - r.left + 12,
      y = e.clientY - r.top + 12;
    el.style.left = `${Math.max(4, x + el.offsetWidth > r.width ? x - el.offsetWidth - 24 : x)}px`;
    el.style.top = `${Math.max(4, y + el.offsetHeight > r.height ? y - el.offsetHeight - 24 : y)}px`;
  }
  const tipMove = (e) => placeTip(tip, e);
  function tipHide() {
    tip.hidden = true;
  }

  const sharedNames = (key, u, v) => {
    const A = ATTRS[key],
      a = A.set[u];
    return [...A.set[v]]
      .filter((t) => a.has(t))
      .map((t) => A.dict[t])
      .sort();
  };
  // « s = … (Cosinus IDF) · méca 0,8 · thème 0,2 · … » : décomposition par attribut pondéré.
  function breakdown(u, v) {
    const { parts } = pairDetail(u, v);
    const w = attrWeights();
    return Object.entries(parts)
      .map(([k, x]) => `${ATTRS[k].short} ${x.toFixed(2)} (×${w[k].toFixed(2)})`)
      .join(" · ");
  }
  // Infobulle d'un jeu : titre, puis deux lignes de critères, puis le début de la description.
  //   ligne 1 : note moyenne · note bayésienne · avis · ressemblance avec le jeu parent
  //   ligne 2 : convoitise · revente (centile et ratio à la médiane) · niveau dans le graphe
  function nodeTip(i, level = null) {
    const g = N[i];
    const p = app.current.parent.get(i);
    const sig = (k, name) => {
      const cls = (k === "wish" ? markWish(i) : markTrade(i)) ? ` class="${k === "wish" ? "w" : "t"}"` : "";
      return `<span${cls}>${name} c${Math.round(BEH[k].pct[i])} (×${Math.exp(BEH[k].x[i] - BEH[k].median).toFixed(2)})</span>`;
    };
    // Votes : « ★ note des joueurs (note bayésienne BGG) »
    const l1 = [
      `★ ${g.av.toFixed(2)} (${g.b.toFixed(2)} BGG)`,
      `${g.r.toLocaleString("fr-FR")} avis`,
      p ? `s ${p[1].toFixed(3)} avec ${escapeHtml(N[p[0]].n)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const l2 = [
      sig("wish", "convoitise"),
      sig("trade", "revente"),
      level !== null ? (level === 0 ? "jeu choisi" : `niveau ${level}`) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      `<b>${escapeHtml(label(i))}</b><span class="tl">${l1}</span><span class="tl">${l2}</span>` +
      (g.ds ? `<span class="ds">${escapeHtml(g.ds)}</span>` : "")
    );
  }
  function linkTip(u, v, s) {
    const list = (xs) => (xs.length ? xs.map(escapeHtml).join(", ") : "aucune");
    const w = attrWeights();
    const commons = ATTR_KEYS.filter((k) => w[k] > 0 || k === "m" || k === "c")
      .map((k) => {
        const xs = sharedNames(k, u, v);
        return `<span class="tg"><b>${ATTRS[k].label} en commun (${xs.length})</b> : ${list(xs)}</span>`;
      })
      .join("");
    return (
      `<b>${escapeHtml(N[u].n)} ↔ ${escapeHtml(N[v].n)}</b><br>s = ${s.toFixed(3)} (${METRICS[state.metric].label})` +
      `<br>${escapeHtml(breakdown(u, v))}${commons}`
    );
  }

  function render() {
    const ex = expand();
    const { level, parent, links, truncated, pruned } = ex;
    app.current = { parent, level };
    $("#tau-msg").textContent =
      state.tau > 0 ? `${pruned} lien${pruned > 1 ? "s" : ""} coupé${pruned > 1 ? "s" : ""}` : "";
    const nPass = app.pass.reduce((a, b) => a + b, 0);
    // Ligne sous Voisins / Profondeur : jeux affichés sur le maximum possible (pire cas W(k, d), budget 300).
    $("#kd-msg").textContent =
      `${level.size - 1} / ${worst(state.k, state.depth)} jeux affichés (max ${BUDGET}), ${links.filter((l) => !l.cross).length} liens d'arbre` +
      (state.cross ? `, ${links.filter((l) => l.cross).length} liens croisés` : "") +
      (truncated ? ` · tronqué à ${MAX_NODES} jeux` : "") +
      ` · ${nPass} / ${N.length} jeux passent les filtres` +
      (level.size === 1 ? " · aucun voisin : élargir les filtres" : "");
    if (state.view === "map") app.drawMap(ex);
    else drawGraph(ex);
    app.drawAgreement();
    app.select(
      state.selected >= 0 && (level.has(state.selected) || state.view === "map") ? state.selected : state.center,
    );
    app.applyPick();
  }

  function drawGraph({ level, parent, links }) {
    const { width, height } = svg.node().getBoundingClientRect();
    const cx = width / 2,
      cy = height / 2;

    // Continuité des positions (corrige le « saut » à chaque actualisation) :
    // sans x/y, d3 place les nouveaux nœuds en spirale autour de (0,0), puis ils glissent vers le centre.
    // 1) on reprend les positions de la simulation précédente, translatées pour que le nouveau centre soit au milieu ;
    // 2) un nœud nouveau naît à côté de son parent (ordre BFS : le parent est déjà placé).
    const prev = new Map(sim ? sim.nodes().map((n) => [n.i, n]) : []);
    const pc = prev.get(state.center);
    const dx = pc ? cx - pc.x : 0,
      dy = pc ? cy - pc.y : 0;
    const placed = new Map();
    const nodes = [...level.keys()].map((i) => {
      const n = { i, d: level.get(i) };
      const o = prev.get(i);
      if (o) {
        n.x = o.x + dx;
        n.y = o.y + dy;
      } else if (n.d === 0) {
        n.x = cx;
        n.y = cy;
      } else {
        const p = placed.get(parent.get(i)[0]) || { x: cx, y: cy };
        const a = Math.random() * 2 * Math.PI;
        n.x = p.x + 30 * Math.cos(a);
        n.y = p.y + 30 * Math.sin(a);
      }
      n.vx = 0;
      n.vy = 0;
      if (n.d === 0) {
        n.fx = cx;
        n.fy = cy;
      }
      placed.set(i, n);
      return n;
    });
    const reused = nodes.filter((n) => prev.has(n.i)).length;
    // Recentrage : la translation (dx, dy) est compensée par le zoom, puis on revient en douceur (panoramique animé).
    if (dx || dy) {
      const t = d3.zoomTransform(svg.node());
      svg.interrupt().call(zoom.transform, t.translate(-dx, -dy));
      svg.transition().duration(450).call(zoom.transform, t);
    }
    const lk = links.map((l) => ({ ...l }));

    const sMin = d3.min(lk, (l) => l.s) ?? 0;
    const lw = d3
      .scaleLinear()
      .domain([Math.min(sMin, 0.99), 1])
      .range([0.6, 4])
      .clamp(true);
    const lkey = (l) => key(l.source.i ?? l.source, l.target.i ?? l.target);

    const link = gLinks
      .selectAll("line")
      .data(lk, lkey)
      .join("line")
      .attr("class", (l) => `link${l.cross ? " cross" : ""}`)
      .attr("stroke-width", (l) => (l.cross ? 0.8 : lw(l.s)));
    // Zone de survol élargie (trait transparent de 9 px) : mécaniques et catégories communes.
    const hit = gHits
      .selectAll("line")
      .data(lk, lkey)
      .join("line")
      .attr("class", "hit")
      .on("mouseenter", (e, l) => {
        link.classed("hover", (x) => x === l);
        tipShow(linkTip(l.source.i, l.target.i, l.s), e);
      })
      .on("mousemove", tipMove)
      .on("mouseleave", () => {
        link.classed("hover", false);
        tipHide();
      });

    const node = gNodes
      .selectAll("g.node")
      .data(nodes, (n) => n.i)
      .join((enter) => {
        const g = enter.append("g");
        g.append("circle").attr("class", "bubble");
        g.append("text").attr("class", "sig-plus").attr("dy", "0.35em");
        g.append("text").attr("class", "sig-minus").attr("dy", "0.35em");
        g.append("text").attr("class", "rating").attr("dy", "0.35em");
        g.append("text").attr("class", "label").attr("dy", "0.32em");
        return g;
      })
      .attr(
        "class",
        (n) =>
          `node d${n.d}${n.i === state.selected ? " selected" : ""}` +
          `${n.d === 0 && !app.pass[n.i] ? " filtered-out" : ""}`,
      );
    const R = (n) => radius(n.i) + (n.d === 0 ? 3 : 0);
    const fill = (n) => (state.colorRating ? ratingColor(N[n.i].av) : depthColor(n.d));
    // Signaux par jeu : « + » verts (convoitise) au-dessus de la note, « − » rouges (revente) en dessous ;
    // « + » : 1 en bas de l'intervalle, 3 en haut ; « − » : l'inverse (3 en bas, 1 en haut).
    const sigLevel = (k, i) => {
      const [lo, hi] = app.sigInt[k];
      const t = hi > lo ? Math.max(0, (BEH[k].pct[i] - lo) / (hi - lo)) : 1;
      // revente : bas de l'intervalle (jeu gardé) = 3 « − », haut = 1
      return Math.min(3, 1 + Math.floor(3 * (k === "trade" ? 1 - t : t)));
    };
    const sigText = (sel, mark, k, ch, sign) =>
      node
        .select(sel)
        .text((n) => (state.signals && mark(n.i) ? ch.repeat(sigLevel(k, n.i)) : ""))
        .attr("y", (n) => sign * R(n) * (state.showRating ? 0.62 : 0.3))
        .style("font-size", (n) => `${Math.max(8, Math.min(13, R(n) * 0.6)).toFixed(1)}px`);
    node.select("circle.bubble").attr("r", R).attr("fill", fill);
    sigText("text.sig-plus", markWish, "wish", "+", -1);
    sigText("text.sig-minus", markTrade, "trade", "−", 1);
    node
      .select("text.rating")
      .text((n) => (state.showRating ? N[n.i].av.toFixed(1) : ""))
      .style("font-size", (n) => `${Math.min(12, R(n) * 0.72).toFixed(1)}px`)
      .style("fill", (n) => textOn(fill(n)));
    node
      .select("text.label")
      .attr("x", (n) => R(n) + 5)
      .text((n) => (n.d === 0 || nodes.length <= 40 || (n.d === 1 && nodes.length <= 80) ? gameName(n.i) : ""));

    node
      .on("click", (e, n) => {
        e.stopPropagation();
        if (app.pick) app.togglePick(n.i);
        else app.select(n.i);
      })
      .on("dblclick", (e, n) => {
        e.stopPropagation();
        if (!app.pick) app.setCenter(n.i);
      })
      .on("mouseenter", (e, n) => {
        tipShow(nodeTip(n.i, n.d), e);
        app.highlight(n.i, lk);
      })
      .on("mousemove", tipMove)
      .on("mouseleave", () => {
        tipHide();
        app.highlight(-1, lk);
      })
      .call(
        d3
          .drag()
          .on("start", (e, n) => {
            if (!e.active) sim.alphaTarget(0.2).restart();
            n.fx = n.x;
            n.fy = n.y;
          })
          .on("drag", (e, n) => {
            n.fx = e.x;
            n.fy = e.y;
          })
          .on("end", (e, n) => {
            if (!e.active) sim.alphaTarget(0);
            if (n.d !== 0) {
              n.fx = null;
              n.fy = null;
            }
          }),
      );

    if (sim) sim.stop();
    // Énergie initiale réduite quand la plupart des nœuds gardent leur place : mouvement limité aux changements.
    const alpha0 = reused / nodes.length > 0.6 ? 0.3 : 1;
    sim = d3
      .forceSimulation(nodes)
      .alpha(alpha0)
      .force(
        "link",
        d3
          .forceLink(lk)
          .id((n) => n.i)
          .distance((l) => (l.cross ? 140 : 40 + 110 * (1 - l.s)))
          .strength((l) => (l.cross ? 0.05 : 0.7)),
      )
      .force("charge", d3.forceManyBody().strength(nodes.length > 120 ? -90 : -180))
      .force(
        "collide",
        d3.forceCollide((n) => radius(n.i) + 3),
      )
      .force("radial", d3.forceRadial((n) => n.d * 95, width / 2, height / 2).strength(0.25))
      .on("tick", ticked);
    // Dessin immédiat aux positions initiales : sinon les éléments nouveaux restent une frame en (0,0).
    ticked();
    function ticked() {
      for (const sel of [link, hit]) {
        sel
          .attr("x1", (l) => l.source.x)
          .attr("y1", (l) => l.source.y)
          .attr("x2", (l) => l.target.x)
          .attr("y2", (l) => l.target.y);
      }
      node.attr("transform", (n) => `translate(${n.x},${n.y})`);
    }
  }

  Object.assign(app, { svg, gLinks, gNodes, gameName, ratingColor, textOn, tipMove });
}
