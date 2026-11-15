/* Graphe des plus proches voisins, calculé dans le navigateur à partir des attributs (src/export_web.py).
 *
 * Similarité : s(u,v) = Σ_k w_k · métrique_k(u,v) sur les 4 attributs (méca., thème, familles, description),
 * w_k = v_k / Σ v (4 curseurs), via des listes inversées.
 * Les voisins sont cherchés parmi les jeux qui passent les filtres ; le graphe est un parcours en largeur (BFS).
 */
import { BUDGET, MAX_NODES, KS, worst, maxDepth, maxK, expand as expandL } from "./lib/bfs.js";
import { loadDataset, TAG_KEYS } from "./lib/dataset.js";
import { buildAttrs } from "./lib/attrs.js";
import { buildEmojiIndex } from "./lib/emoji-index.js";
import { METRICS, METRIC_KEYS, attrPair as attrPairL, attrWeights as attrWeightsL, pairDetail as pairDetailL } from "./lib/metrics.js";
import { buildSignals, sigActive as sigActiveL, inInt as inIntL, SIG_DEFAULT } from "./lib/signals.js";
import { buildGemQ } from "./lib/gems.js";
import { createNeighborIndex } from "./lib/neighbors.js";
import { createKeywordText } from "./lib/keywords.js";
import { createFilterState, computePass, filterCount, reqBanCount, rateActive as rateActiveL, setKeywords, clearReqBan as clearReqBanL } from "./lib/filters.js";
import { createCenters } from "./lib/map-centers.js";
import { agreementConfigs, consensus } from "./lib/agreement.js";
import { escapeHtml, fr } from "./ui/html.js";
import { installHelp } from "./ui/help-tooltip.js";
import { createBandDrag } from "./ui/dual-range.js";

(() => {
  "use strict";
  const D = window.BGG_DATA;
  const $ = (s) => document.querySelector(s);
  const { hide: hideHelp } = installHelp({ el: $("#help"), delay: 300, followFocus: true });
  if (!D || !window.d3) {
    $("#search-msg").textContent = !D
      ? "Données absentes : lancer python3 src/export_web.py."
      : "d3 n'a pas pu être chargé (connexion internet requise pour le CDN).";
    $("#search-msg").classList.add("err");
    return;
  }

  const N = D.nodes;
  const ds = loadDataset(D);
  const css = getComputedStyle(document.documentElement);
  const depthColor = (d) => css.getPropertyValue(`--d${Math.min(d, 4)}`).trim();

  const { ATTRS, ATTR_KEYS, franchise } = buildAttrs(D);

  // --- Émojis (web/emoji.js) : un par thème, un par famille de mécaniques --------------------------
  const EMO = window.BGG_EMOJI || { themes: {}, families: {} };
  const EI = buildEmojiIndex(D, EMO);
  const { emo, DOM_EMO, NON_THEMATIC } = EI;
  if (EI.missing.mecaniques.length || EI.missing.themes.length) console.warn("emoji.js : sans émoji", EI.missing);
  const emoTag = (key, t) => { const e = emo(key, t); return e ? `<span class="emo">${e}</span>` : ""; };

  // --- Métriques (web/lib/metrics.js) ---------------------------------------------------------------
  const attrPair = (key, metric, u, v, ctx) => attrPairL(ATTRS, key, metric, u, v, ctx);

  // --- Signaux par jeu : convoitise et revente (web/lib/signals.js) -------------------------------------
  const BEH = buildSignals(N);
  // Intervalle de centiles [bas, haut] par signal ; [0, 100] = inactif. Par défaut : « Convoité, gardé » (filtre coché).
  const sigInt = { wish: [...SIG_DEFAULT.wish], trade: [...SIG_DEFAULT.trade] };
  const sigActive = (k) => sigActiveL(sigInt, k);
  const inInt = (k, i) => inIntL(BEH, sigInt, k, i);
  // Marquage : point vert (convoitise) / contour rouge (revente) pour les jeux dans l'intervalle actif.
  const markWish = (i) => sigActive("wish") && inInt("wish", i);
  const markTrade = (i) => sigActive("trade") && inInt("trade", i);

  // --- État ---------------------------------------------------------------------------------
  const state = {
    center: -1, selected: -1, k: 5, depth: 2, cross: false, tau: 0, showRating: false, colorRating: false,
    // Pondération : un curseur v_k ∈ [0, 100] par attribut, normalisé w_k = v_k / Σ v (au moins un v_k > 0).
    wRaw: { m: 100, c: 0, f: 0, d: 0 },
    metric: "cos", signals: true, emoji: false,
    gems: true, gemBeta: 2, // « Pépites cachées » actif par défaut, intensité β = 2,0
    view: "graph", mapSel: "auto", famView: false, famOpen: null, famCenter: "mean",
  };
  // Filtres (web/lib/filters.js) : état unique ; signaux filtrés par défaut (« Convoité, gardé »).
  const FS = createFilterState({ reqKeys: ATTR_KEYS, notTagKeys: [], sigFilter: true });
  const attrWeights = () => attrWeightsL(ATTR_KEYS, state.wRaw);
  // Configuration du calcul : métrique, poids par attribut.
  const currentCfg = () => ({ metric: state.metric, w: attrWeights() });
  // Ressemblance d'une paire pour une configuration (infobulles, détails) et sa décomposition par attribut.
  const pairDetail = (u, v, cfg = currentCfg()) => pairDetailL(ATTRS, ATTR_KEYS, u, v, cfg);

  let pass = new Uint8Array(N.length).fill(1);
  const nbIndex = createNeighborIndex({ N, ATTRS, ATTR_KEYS, franchise, gemQ: buildGemQ(N) });
  // Top-K_MAX voisins de u parmi les jeux qui passent les filtres (en cache tant que les réglages ne changent pas).
  const neighbors = (u, cfg = currentCfg(), gems = state.gems) => nbIndex.neighbors(u, cfg,
    { gems, gemBeta: state.gemBeta, noFranchise: FS.noFranchise, noReimpl: FS.noReimpl, noExpLine: FS.noExpLine }, pass);

  // --- Filtres -------------------------------------------------------------------------------
  const num = (id) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : null;
  };
  // Recherche par mots-clés, notes, signaux, étiquettes : voir web/lib/filters.js (état FS, prédicat unique).
  const kwText = createKeywordText(D);
  function readFilters() {
    setKeywords(FS, $("#f-kw").value);
    Object.assign(FS.nums, { plMin: num("#pl-min"), plMax: num("#pl-max"), tMin: num("#t-min"), tMax: num("#t-max"),
      ageMax: num("#age-max"), wMin: num("#w-min"), wMax: num("#w-max") });
    return FS;
  }
  const rateActive = (k) => rateActiveL(FS, k);
  const passCtx = () => ({ kwText: (g) => kwText(g), terms: (g, i, key) => ATTRS[key].set[i],
    signals: state.signals ? { active: sigActive, inInt } : null });
  function applyFilters() {
    const F = readFilters();
    pass = computePass(N, F, passCtx());
    $("#filter-count").textContent = filterCount(F, { sigOn: state.signals, sigActive: sigActive("wish") || sigActive("trade") }) || "";
    $("#req-count").textContent = reqBanCount(F) || "";
    if (!$("#filter-pop").hidden) drawFilterPop();
    invalidate();
  }

  // Indispensables / interdites : pastilles à trois états, construites depuis le jeu central.
  //   clic sur la pastille : neutre <-> indispensable (✓, le voisin doit l'avoir) ; une interdite redevient neutre
  //   clic sur la croix (visible au survol, à droite) : interdite (✕, le voisin ne doit pas l'avoir) <-> neutre
  // Une étiquette active absente du nouveau jeu central reste affichée (« extra ») pour pouvoir la retirer.
  const clearReqBan = () => clearReqBanL(FS);
  const REQ_SHOW = { m: Infinity, c: Infinity, f: 16, d: 14 }; // nombre de pastilles proposées (familles et mots : les plus informatives)
  function drawRequired() {
    if (state.center < 0) return;
    const c = N[state.center];
    for (const key of ATTR_KEYS) {
      const A = ATTRS[key];
      const ci = state.center;
      const own = A.set[ci];
      // Familles et description : les étiquettes les plus caractéristiques (poids décroissant) ; sinon toutes.
      const ranked = [...A.vec[ci]].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      const base = key === "m" || key === "c" ? [...own] : ranked.slice(0, REQ_SHOW[key]);
      const items = [...new Set([...base, ...FS.req[key], ...FS.ban[key]])]
        .map((t) => [t, A.dict[t]])
        .sort((a, b) => a[1].localeCompare(b[1]));
      const box = $(`#req-${key}`);
      box.innerHTML = items.map(([t, name]) => {
        const st = FS.req[key].has(t) ? "on" : FS.ban[key].has(t) ? "ban" : "";
        const extra = st && !own.has(t);
        const help = st === "on" ? "Indispensable : chaque voisin doit l'avoir. Clic : revenir à neutre ; croix : l'interdire."
          : st === "ban" ? "Interdite : aucun voisin ne doit l'avoir. Clic ou croix : revenir à neutre."
            : "Neutre. Clic : la rendre indispensable ; croix à droite : l'interdire.";
        const xHelp = st === "ban" ? "Retirer l'interdiction." : "Interdire : aucun voisin ne doit l'avoir.";
        return `<span class="chip toggle${st ? ` ${st}` : ""}${extra ? " extra" : ""}" data-t="${t}" role="button" ` +
          `tabindex="0" data-help="${escapeHtml(help + (extra ? " (absente du jeu central)" : ""))}">${emoTag(key, t)}${escapeHtml(name)}` +
          `<span class="ban-x" aria-label="Interdire" data-help="${escapeHtml(xHelp)}">✕</span></span>`;
      }).join("") || `<span class="hint">aucune</span>`;
      box.querySelectorAll(".chip").forEach((ch) => {
        const t = +ch.dataset.t;
        const done = () => { hideHelp(); drawRequired(); applyFilters(); };
        // Pastille : neutre <-> indispensable ; une interdite redevient neutre.
        const toggleReq = () => {
          if (FS.ban[key].delete(t)) return done();
          if (!FS.req[key].delete(t)) FS.req[key].add(t);
          done();
        };
        // Croix : interdite <-> neutre (une indispensable devient directement interdite).
        const toggleBan = () => {
          if (!FS.ban[key].delete(t)) {
            FS.req[key].delete(t);
            if (key === "f" && FS.tags.f.delete(t)) drawTagChips("f"); // la même famille ne reste pas choisie sous Famille
            FS.ban[key].add(t);
          }
          done();
        };
        ch.addEventListener("click", (e) => (e.target.closest(".ban-x") ? toggleBan() : toggleReq()));
        ch.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleReq(); }
          else if (e.key === "Delete" || e.key === "Backspace" || e.key === "x") { e.preventDefault(); toggleBan(); }
        });
      });
    }
  }
  function invalidate() {
    nbIndex.invalidate();
    if (state.center >= 0) render();
  }

  // Champs d'étiquettes (famille, auteur, illustrateur, éditeur) : liste de suggestions et pastilles.
  const tagIndex = ds.tagIndex;
  for (const [key, dname] of Object.entries(TAG_KEYS)) {
    const labels = D.dict[dname];
    const freq = ds.tagFreq[key], order = ds.tagOrder[key];
    $(`#dl-${key}`).innerHTML = order.map((i) => `<option value="${escapeHtml(labels[i])}">${freq[i]} jeux</option>`).join("");
    const input = $(`#tf-${key}`);
    const tryAdd = () => {
      const i = tagIndex[key].get(input.value.trim().toLowerCase());
      if (i === undefined) return;
      input.value = "";
      addTag(key, i);
    };
    input.addEventListener("change", tryAdd);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") tryAdd(); });
  }
  function addTag(key, i) {
    if (key === "f") FS.ban.f.delete(i); // jamais sélectionnée et barrée à la fois
    FS.tags[key].add(i);
    drawTagChips(key);
    applyFilters();
  }
  function drawTagChips(key) {
    const box = document.querySelector(`.tagfilter[data-key="${key}"] .chips`);
    box.innerHTML = [...FS.tags[key]]
      .map((i) => `<span class="chip removable" data-i="${i}" data-help="Clic : retirer ce filtre.">${escapeHtml(D.dict[TAG_KEYS[key]][i])}</span>`)
      .join("");
    box.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      FS.tags[key].delete(+c.dataset.i);
      drawTagChips(key);
      applyFilters();
    }));
  }

  // Poids : désactivé si absent des données.
  if (!D.meta.has_weight) {
    $("#w-min").disabled = $("#w-max").disabled = true;
    $("#weight-row").dataset.help = "Poids BGG (complexité, 1–5) : absent du dump actuel, filtre désactivé. " +
      "Il faut data/raw/weights.csv (API BGG ou autre source), puis relancer src/export_web.py.";
  }

  // --- Recherche du jeu -----------------------------------------------------------------------
  const { label, resolve } = ds;
  const byLabel = new Map(N.map((_, i) => [label(i).toLowerCase(), i]));
  // N est déjà trié par nombre d'avis décroissant (export_web.py).
  $("#games").innerHTML = N.map((_, i) => `<option value="${escapeHtml(label(i))}">`).join("");

  // --- BFS ------------------------------------------------------------------------------------
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  // Parcours en largeur : web/lib/bfs.js (voisins calculés avec les réglages courants).
  const expand = () => expandL(state, (u) => neighbors(u));

  // --- Rendu SVG ----------------------------------------------------------------------------
  const svg = d3.select("#graph");
  const root = svg.append("g");
  const gLinks = root.append("g");
  const gHits = root.append("g");
  const gNodes = root.append("g");
  const zoom = d3.zoom().scaleExtent([0.2, 5]).on("zoom", (e) => root.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);
  const tip = $("#tooltip");
  // Nom affiché sur le graphe et la carte : précédé de l'émoji du thème dominant si la case « Émojis » est cochée.
  const gameName = (i) => (state.emoji && DOM_EMO[i] ? `${DOM_EMO[i]} ${N[i].n}` : N[i].n);
  let sim = null;
  let current = { parent: new Map() };

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
  function tipShow(html, e) { tip.innerHTML = html; tip.hidden = false; tipMove(e); }
  // Place une infobulle près du pointeur, dans la zone du graphe (bascule à gauche / au-dessus près des bords).
  function placeTip(el, e) {
    const r = $("#graph-wrap").getBoundingClientRect();
    const x = e.clientX - r.left + 12, y = e.clientY - r.top + 12;
    el.style.left = `${Math.max(4, x + el.offsetWidth > r.width ? x - el.offsetWidth - 24 : x)}px`;
    el.style.top = `${Math.max(4, y + el.offsetHeight > r.height ? y - el.offsetHeight - 24 : y)}px`;
  }
  const tipMove = (e) => placeTip(tip, e);
  function tipHide() { tip.hidden = true; }

  const sharedNames = (key, u, v) => {
    const A = ATTRS[key], a = A.set[u];
    return [...A.set[v]].filter((t) => a.has(t)).map((t) => A.dict[t]).sort();
  };
  // « s = … (Cosinus IDF) · méca 0,8 · thème 0,2 · … » : décomposition par attribut pondéré.
  function breakdown(u, v) {
    const { parts } = pairDetail(u, v);
    const w = attrWeights();
    return Object.entries(parts).map(([k, x]) => `${ATTRS[k].short} ${x.toFixed(2)} (×${w[k].toFixed(2)})`).join(" · ");
  }
  // Infobulle d'un jeu : titre, puis deux lignes de critères, puis le début de la description.
  //   ligne 1 : note moyenne · note bayésienne · avis · ressemblance avec le jeu parent
  //   ligne 2 : convoitise · revente (centile et ratio à la médiane) · niveau dans le graphe
  function nodeTip(i, level = null) {
    const g = N[i];
    const p = current.parent.get(i);
    const sig = (k, name) => {
      const cls = (k === "wish" ? markWish(i) : markTrade(i)) ? ` class="${k === "wish" ? "w" : "t"}"` : "";
      return `<span${cls}>${name} c${Math.round(BEH[k].pct[i])} (×${Math.exp(BEH[k].x[i] - BEH[k].median).toFixed(2)})</span>`;
    };
    // Votes : « ★ note des joueurs (note bayésienne BGG) »
    const l1 = [`★ ${g.av.toFixed(2)} (${g.b.toFixed(2)} BGG)`, `${g.r.toLocaleString("fr-FR")} avis`,
      p ? `s ${p[1].toFixed(3)} avec ${escapeHtml(N[p[0]].n)}` : null].filter(Boolean).join(" · ");
    const l2 = [sig("wish", "convoitise"), sig("trade", "revente"),
      level !== null ? (level === 0 ? "jeu choisi" : `niveau ${level}`) : null].filter(Boolean).join(" · ");
    return `<b>${escapeHtml(label(i))}</b><span class="tl">${l1}</span><span class="tl">${l2}</span>` +
      (g.ds ? `<span class="ds">${escapeHtml(g.ds)}</span>` : "");
  }
  function linkTip(u, v, s) {
    const list = (xs) => (xs.length ? xs.map(escapeHtml).join(", ") : "aucune");
    const w = attrWeights();
    const commons = ATTR_KEYS.filter((k) => w[k] > 0 || k === "m" || k === "c").map((k) => {
      const xs = sharedNames(k, u, v);
      return `<span class="tg"><b>${ATTRS[k].label} en commun (${xs.length})</b> : ${list(xs)}</span>`;
    }).join("");
    return `<b>${escapeHtml(N[u].n)} ↔ ${escapeHtml(N[v].n)}</b><br>s = ${s.toFixed(3)} (${METRICS[state.metric].label})` +
      `<br>${escapeHtml(breakdown(u, v))}${commons}`;
  }

  function render() {
    const ex = expand();
    const { level, parent, links, truncated, pruned } = ex;
    current = { parent, level };
    $("#tau-msg").textContent = state.tau > 0 ? `${pruned} lien${pruned > 1 ? "s" : ""} coupé${pruned > 1 ? "s" : ""}` : "";
    const nPass = pass.reduce((a, b) => a + b, 0);
    // Ligne sous Voisins / Profondeur : jeux affichés sur le maximum possible (pire cas W(k, d), budget 300).
    $("#kd-msg").textContent =
      `${level.size - 1} / ${worst(state.k, state.depth)} jeux affichés (max ${BUDGET}), ${links.filter((l) => !l.cross).length} liens d'arbre` +
      (state.cross ? `, ${links.filter((l) => l.cross).length} liens croisés` : "") +
      (truncated ? ` · tronqué à ${MAX_NODES} jeux` : "") +
      ` · ${nPass} / ${N.length} jeux passent les filtres` +
      (level.size === 1 ? " · aucun voisin : élargir les filtres" : "");
    if (state.view === "map") drawMap(ex); else drawGraph(ex);
    drawAgreement();
    select(state.selected >= 0 && (level.has(state.selected) || state.view === "map") ? state.selected : state.center);
    applyPick();
  }

  function drawGraph({ level, parent, links }) {
    const { width, height } = svg.node().getBoundingClientRect();
    const cx = width / 2, cy = height / 2;

    // Continuité des positions (corrige le « saut » à chaque actualisation) :
    // sans x/y, d3 place les nouveaux nœuds en spirale autour de (0,0), puis ils glissent vers le centre.
    // 1) on reprend les positions de la simulation précédente, translatées pour que le nouveau centre soit au milieu ;
    // 2) un nœud nouveau naît à côté de son parent (ordre BFS : le parent est déjà placé).
    const prev = new Map(sim ? sim.nodes().map((n) => [n.i, n]) : []);
    const pc = prev.get(state.center);
    const dx = pc ? cx - pc.x : 0, dy = pc ? cy - pc.y : 0;
    const placed = new Map();
    const nodes = [...level.keys()].map((i) => {
      const n = { i, d: level.get(i) };
      const o = prev.get(i);
      if (o) {
        n.x = o.x + dx; n.y = o.y + dy;
      } else if (n.d === 0) {
        n.x = cx; n.y = cy;
      } else {
        const p = placed.get(parent.get(i)[0]) || { x: cx, y: cy };
        const a = Math.random() * 2 * Math.PI;
        n.x = p.x + 30 * Math.cos(a); n.y = p.y + 30 * Math.sin(a);
      }
      n.vx = 0; n.vy = 0;
      if (n.d === 0) { n.fx = cx; n.fy = cy; }
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
    const lw = d3.scaleLinear().domain([Math.min(sMin, 0.99), 1]).range([0.6, 4]).clamp(true);
    const lkey = (l) => key(l.source.i ?? l.source, l.target.i ?? l.target);

    const link = gLinks.selectAll("line").data(lk, lkey)
      .join("line")
      .attr("class", (l) => `link${l.cross ? " cross" : ""}`)
      .attr("stroke-width", (l) => (l.cross ? 0.8 : lw(l.s)));
    // Zone de survol élargie (trait transparent de 9 px) : mécaniques et catégories communes.
    const hit = gHits.selectAll("line").data(lk, lkey)
      .join("line")
      .attr("class", "hit")
      .on("mouseenter", (e, l) => {
        link.classed("hover", (x) => x === l);
        tipShow(linkTip(l.source.i, l.target.i, l.s), e);
      })
      .on("mousemove", tipMove)
      .on("mouseleave", () => { link.classed("hover", false); tipHide(); });

    const node = gNodes.selectAll("g.node").data(nodes, (n) => n.i)
      .join((enter) => {
        const g = enter.append("g");
        g.append("circle").attr("class", "bubble");
        g.append("circle").attr("class", "wish-dot");
        g.append("text").attr("class", "rating").attr("dy", "0.35em");
        g.append("text").attr("class", "label").attr("dy", "0.32em");
        return g;
      })
      .attr("class", (n) => `node d${n.d}${n.i === state.selected ? " selected" : ""}` +
        `${n.d === 0 && !pass[n.i] ? " filtered-out" : ""}`);
    const R = (n) => radius(n.i) + (n.d === 0 ? 3 : 0);
    const fill = (n) => (state.colorRating ? ratingColor(N[n.i].av) : depthColor(n.d));
    // Signaux par jeu : revente élevée → contour rouge ; convoitise élevée → point vert intérieur.
    node.select("circle.bubble")
      .attr("r", R)
      .attr("fill", fill)
      .style("stroke", (n) => (state.signals && markTrade(n.i) ? "var(--sig-trade)" : null))
      .style("stroke-width", (n) => (state.signals && markTrade(n.i) ? "3px" : null));
    // Point vert : en haut de la bulle si la note y est écrite, sinon au centre.
    node.select("circle.wish-dot")
      .attr("r", (n) => (state.signals && markWish(n.i) ? Math.max(2.5, R(n) * (state.showRating ? 0.22 : 0.32)) : 0))
      .attr("cy", (n) => (state.showRating ? -R(n) * 0.6 : 0));
    node.select("text.rating")
      .text((n) => (state.showRating ? N[n.i].av.toFixed(1) : ""))
      .style("font-size", (n) => `${Math.min(12, R(n) * 0.72).toFixed(1)}px`)
      .style("fill", (n) => textOn(fill(n)));
    node.select("text.label")
      .attr("x", (n) => R(n) + 5)
      .text((n) => (n.d === 0 || nodes.length <= 40 || (n.d === 1 && nodes.length <= 80) ? gameName(n.i) : ""));

    node
      .on("click", (e, n) => { e.stopPropagation(); if (pick) togglePick(n.i); else select(n.i); })
      .on("dblclick", (e, n) => { e.stopPropagation(); if (!pick) setCenter(n.i); })
      .on("mouseenter", (e, n) => {
        tipShow(nodeTip(n.i, n.d), e);
        highlight(n.i, lk);
      })
      .on("mousemove", tipMove)
      .on("mouseleave", () => { tipHide(); highlight(-1, lk); })
      .call(d3.drag()
        .on("start", (e, n) => { if (!e.active) sim.alphaTarget(0.2).restart(); n.fx = n.x; n.fy = n.y; })
        .on("drag", (e, n) => { n.fx = e.x; n.fy = e.y; })
        .on("end", (e, n) => { if (!e.active) sim.alphaTarget(0); if (n.d !== 0) { n.fx = null; n.fy = null; } }));

    if (sim) sim.stop();
    // Énergie initiale réduite quand la plupart des nœuds gardent leur place : mouvement limité aux changements.
    const alpha0 = reused / nodes.length > 0.6 ? 0.3 : 1;
    sim = d3.forceSimulation(nodes)
      .alpha(alpha0)
      .force("link", d3.forceLink(lk).id((n) => n.i)
        .distance((l) => (l.cross ? 140 : 40 + 110 * (1 - l.s)))
        .strength((l) => (l.cross ? 0.05 : 0.7)))
      .force("charge", d3.forceManyBody().strength(nodes.length > 120 ? -90 : -180))
      .force("collide", d3.forceCollide((n) => radius(n.i) + 3))
      .force("radial", d3.forceRadial((n) => n.d * 95, width / 2, height / 2).strength(0.25))
      .on("tick", ticked);
    // Dessin immédiat aux positions initiales : sinon les éléments nouveaux restent une frame en (0,0).
    ticked();
    function ticked() {
      for (const sel of [link, hit]) {
        sel.attr("x1", (l) => l.source.x).attr("y1", (l) => l.source.y)
          .attr("x2", (l) => l.target.x).attr("y2", (l) => l.target.y);
      }
      node.attr("transform", (n) => `translate(${n.x},${n.y})`);
    }
  }

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
  const mzoom = d3.zoom().scaleExtent([0.5, 40]).on("zoom", (e) => {
    if (!Number.isFinite(e.transform.k)) return;
    mroot.attr("transform", e.transform);
    mk = e.transform.k;
    mPts.selectAll("circle").attr("r", 2.6 / mk);
    mSel.selectAll("circle").attr("r", (n) => (n.d === 0 ? 8 : 5.5) / mk).attr("stroke-width", 1.5 / mk);
    mEdges.selectAll("line").attr("stroke-width", 1.2 / mk);
    mLabels.selectAll("text").style("font-size", `${11 / mk}px`).style("stroke-width", `${3 / mk}px`).attr("dx", 7 / mk);
    mFamLinks.selectAll("line").attr("stroke-width", (l) => (l.all ? 0.6 : 1.4) / mk);
    mFam.selectAll("circle").attr("r", 14 / mk).attr("stroke-width", 2 / mk);
    mFam.selectAll("text").style("font-size", `${17 / mk}px`);
  });
  msvg.call(mzoom).on("dblclick.zoom", null);
  const onMap = N.map((g, i) => i).filter((i) => N[i].xy);
  let mx = null, my = null, mapFor = null, lastMap = -1;
  const MAP_KEYS = D.meta.map_keys || [];
  // Carte affichée : celle choisie, ou en mode « auto » celle de l'attribut le plus pondéré.
  const mapIdx = () => {
    if (state.mapSel !== "auto") return state.mapSel;
    const w = attrWeights();
    return Math.max(0, d3.maxIndex(MAP_KEYS, (k) => w[k] ?? -1));
  };
  const P = (i) => N[i].xy[mapIdx()];

  // --- Centres des thèmes, sur chaque carte ----------------------------------------------------------
  // Groupes = thèmes (catégories BGG) réunis par émoji (ex. 🪖 = toutes les guerres modernes), hors catégories
  // de format ou de licence (emoji.js, nonThematic). Un jeu appartient à un groupe s'il en a au moins une
  // catégorie, avec un poids w = (nb de ses catégories thématiques dans le groupe) / (nb total de ses catégories
  // thématiques) : un jeu mono-thème pèse plus qu'un jeu à cinq thèmes. Centre = moyenne pondérée ou pic
  // d'enrichissement, calculé une fois par carte (une par attribut) et mis en cache.
  const CT = createCenters({ D, EMO, NON_THEMATIC });
  const { GROUPS, FAM_KEYS, GAME_FAMS, FAM_MEMBERS, centroids } = CT;
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
    const ptFill = (i) => (state.colorRating ? ratingColor(N[i].av) : "var(--d4)");
    mPts.selectAll("circle").data(onMap, (i) => i)
      .join("circle")
      .attr("class", (i) => `pt${pass[i] ? "" : " out"}`)
      .call((sel) => T(sel).attr("cx", (i) => mx(P(i)[0])).attr("cy", (i) => my(P(i)[1])))
      .attr("r", 2.6 / mk)
      .attr("fill", ptFill)
      .on("mouseenter", (e, i) => tipShow(nodeTip(i, level.has(i) ? level.get(i) : null), e))
      .on("mousemove", tipMove)
      .on("mouseleave", tipHide)
      .on("click", (e, i) => { e.stopPropagation(); select(i); })
      .on("dblclick", (e, i) => { e.stopPropagation(); setCenter(i); });

    // Jeux du graphe courant : liens de l'arbre puis points mis en avant (couleur du niveau ou de la note).
    const tree = links.filter((l) => !l.cross && N[l.source].xy && N[l.target].xy);
    mEdges.selectAll("line").data(tree, (l) => key(l.source, l.target))
      .join("line")
      .attr("class", "edge")
      .call((sel) => T(sel).attr("x1", (l) => mx(P(l.source)[0])).attr("y1", (l) => my(P(l.source)[1]))
        .attr("x2", (l) => mx(P(l.target)[0])).attr("y2", (l) => my(P(l.target)[1])))
      .attr("stroke-width", 1.2 / mk);
    const sel = [...level.keys()].filter((i) => N[i].xy).map((i) => ({ i, d: level.get(i) }));
    mSel.selectAll("circle").data(sel, (n) => n.i)
      .join("circle")
      .attr("class", "pt in")
      .call((sel) => T(sel).attr("cx", (n) => mx(P(n.i)[0])).attr("cy", (n) => my(P(n.i)[1])))
      .attr("r", (n) => (n.d === 0 ? 8 : 5.5) / mk)
      .attr("stroke-width", 1.5 / mk)
      .attr("fill", (n) => (state.colorRating ? ratingColor(N[n.i].av) : depthColor(n.d)))
      .style("stroke", (n) => (state.signals && markTrade(n.i) ? "var(--sig-trade)" : null))
      .on("mouseenter", (e, n) => tipShow(nodeTip(n.i, n.d), e))
      .on("mousemove", tipMove)
      .on("mouseleave", tipHide)
      .on("click", (e, n) => { e.stopPropagation(); select(n.i); })
      .on("dblclick", (e, n) => { e.stopPropagation(); setCenter(n.i); });
    mLabels.selectAll("text").data(sel.filter((n) => n.d <= 1), (n) => n.i)
      .join("text")
      .call((sel) => T(sel).attr("x", (n) => mx(P(n.i)[0])).attr("y", (n) => my(P(n.i)[1])))
      .attr("dx", 7 / mk).attr("dy", "0.32em")
      .style("font-size", `${11 / mk}px`).style("stroke-width", `${3 / mk}px`)
      .text((n) => gameName(n.i));
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
    mFamLinks.selectAll("line").data(links, (l) => `${l.f}|${l.i}|${l.all}`)
      .join("line")
      .attr("class", (l) => `fam-link${l.all ? " all" : ""}${state.famOpen === l.f ? " open" : ""}`)
      .attr("stroke-width", (l) => (l.all ? 0.6 : 1.4) / mk)
      .call((sel) => T(sel).attr("x1", (l) => mx(C[l.f].x)).attr("y1", (l) => my(C[l.f].y))
        .attr("x2", (l) => mx(P(l.i)[0])).attr("y2", (l) => my(P(l.i)[1])));
    const g = mFam.selectAll("g.fam").data(cents, (c) => c.f)
      .join((enter) => {
        const e = enter.append("g").attr("class", "fam");
        e.append("circle");
        e.append("text").attr("text-anchor", "middle").attr("dy", "0.35em");
        return e;
      })
      .classed("open", (c) => state.famOpen === c.f)
      .classed("dim", (c) => state.famOpen && state.famOpen !== c.f);
    g.call((sel) => T(sel).attr("transform", (c) => `translate(${mx(c.x)},${my(c.y)})`));
    g.select("circle").attr("r", 14 / mk).attr("stroke-width", 2 / mk);
    g.select("text").style("font-size", `${17 / mk}px`).text((c) => GROUPS[c.f].emoji);
    g.on("mouseenter", (e, c) => {
      const F = GROUPS[c.f];
      const inG = [...level.keys()].filter((i) => GAME_FAMS[i].has(c.f)).length;
      tipShow(`<b>${F.emoji} ${escapeHtml(F.label)}</b><span class="tl">${c.n} jeux de la carte · ${inG} dans le graphe · ` +
        `dispersion ${c.spread.toFixed(2)}${c.lift ? ` · sur-représentation ×${c.lift.toFixed(1)} au pic` : ""}</span><span class="ds">${escapeHtml(F.cats.join(", "))}</span>` +
        `<span class="tl">Clic : ${state.famOpen === c.f ? "masquer" : "afficher"} les liens vers tous ses jeux.</span>`, e);
    })
      .on("mousemove", tipMove)
      .on("mouseleave", tipHide)
      .on("click", (e, c) => {
        e.stopPropagation();
        state.famOpen = state.famOpen === c.f ? null : c.f;
        tipHide();
        render();
      });
  }

  function setView(v) {
    if (v === "map" && !D.meta.map_method) {
      $("#map-msg").textContent = "Carte absente : lancer python3 src/build_map.py puis src/export_web.py.";
      return;
    }
    if (v !== "graph" && pick) endPick(); // la sélection ne se fait que sur le graphe
    state.view = v;
    document.querySelectorAll(".view-btn").forEach((b) => {
      b.classList.toggle("on", b.dataset.view === v);
      b.setAttribute("aria-pressed", b.dataset.view === v);
    });
    // Sur un <svg>, la propriété .hidden n'existe pas (simple expando) : on manipule l'attribut.
    $("#graph").toggleAttribute("hidden", v !== "graph");
    $("#map").toggleAttribute("hidden", v !== "map");
    $("#map-alpha-row").hidden = v !== "map";
    $("#fam-btn").hidden = v !== "map";
    // la note écrite et les liens croisés n'existent que sur le graphe
    $("#show-rating").hidden = $("#cross").hidden = v !== "graph";
    mapFor = null; // tailles à recalculer une fois la vue affichée
    tipHide();
    if (state.center >= 0) render();
    if (v === "map") focusMap();
  }
  // Boutons de choix de la carte : Auto (attribut le plus pondéré) ou la carte d'un attribut seul.
  function drawMapAlphaButtons() {
    const m = mapIdx();
    const opts = [["auto", "Auto", "La carte suit les curseurs : on affiche la carte de l'attribut le plus pondéré."]]
      .concat(MAP_KEYS.map((k, j) => [j, ATTRS[k].short,
        `Carte t-SNE calculée avec « ${ATTRS[k].label} » seul (100 %), cosinus IDF.`]));
    $("#map-alpha-row").innerHTML = opts.map(([v, lab, help]) => {
      const on = state.mapSel === v || (state.mapSel === "auto" && v === m);
      return `<button type="button" class="view-btn${on ? " on" : ""}${v === "auto" && state.mapSel === "auto" ? " on" : ""}" ` +
        `data-ma="${v}" data-help="${escapeHtml(help)}">${lab}</button>`;
    }).join("");
    $("#map-alpha-row").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.mapSel = b.dataset.ma === "auto" ? "auto" : +b.dataset.ma;
      hideHelp();
      render();
    }));
  }
  // Recadre la carte sur le jeu central (zoom ×3), en douceur.
  function focusMap() {
    const g = N[state.center];
    if (!g || !g.xy) return;
    mapScales();
    const xy = P(state.center);
    const { width, height } = msvg.node().getBoundingClientRect();
    const k = Math.max(mk, 3);
    msvg.transition().duration(500).call(mzoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-mx(xy[0]), -my(xy[1])));
  }

  function highlight(i, lk) {
    if (i < 0) {
      gNodes.selectAll("g.node").classed("dim", false);
      gLinks.selectAll("line").classed("dim", false);
      return;
    }
    const near = new Set([i]);
    lk.forEach((l) => {
      if (l.source.i === i) near.add(l.target.i);
      if (l.target.i === i) near.add(l.source.i);
    });
    gNodes.selectAll("g.node").classed("dim", (n) => !near.has(n.i));
    gLinks.selectAll("line").classed("dim", (l) => l.source.i !== i && l.target.i !== i);
  }

  // --- Panneau de détails -------------------------------------------------------------------
  function select(i) {
    state.selected = i;
    gNodes.selectAll("g.node").classed("selected", (n) => n.i === i);
    const g = N[i];
    const c = N[state.center];
    const isCenter = i === state.center;
    const p = current.parent.get(i);

    // Étiquettes du jeu cliqué : un clic active / retire le filtre correspondant à gauche (orange des deux côtés).
    //   mécaniques, catégories -> « Garder / exclure » (indispensable) ; auteurs, illustrateurs, éditeurs, familles ->
    //   champs Auteur / Illustrateur / Éditeur / Famille. Étiquette filtrée : pleine avec ✓ ; interdite : rouge barrée ;
    //   sinon, commune avec le jeu central : orange et marron (« shared »).
    const fChip = (key, t, name, shared, kind) => {
      const on = kind === "req" ? FS.req[key].has(t) : FS.tags[key].has(t);
      const ban = kind === "req" ? FS.ban[key].has(t) : key === "f" && FS.ban.f.has(t);
      const cls = on ? " f-on" : ban ? " f-ban" : shared ? " shared" : "";
      const help = on ? "Filtre actif (à gauche aussi). Clic : le retirer des deux côtés."
        : ban ? "Interdite dans « Garder / exclure ». Clic : la rendre indispensable."
          : "Clic : filtrer sur cette étiquette (seuls les jeux qui l'ont seront proposés).";
      return `<span class="chip fchip${cls}" data-fk="${key}" data-ft="${t}" data-kind="${kind}" role="button" tabindex="0" data-help="${help}">` +
        `${kind === "req" ? emoTag(key, t) : ""}${escapeHtml(name)}</span>`;
    };
    const sharedChips = (key, dname) => {
      const ref = new Set(c[key]);
      return g[key].map((t) => [t, D.dict[dname][t]]).sort((a, b) => a[1].localeCompare(b[1]))
        .map(([t, name]) => fChip(key, t, name, !isCenter && ref.has(t), "req"))
        .join("") || `<span class="hint">aucune</span>`;
    };
    const addableChips = (key, max = 8) => {
      const items = g[key];
      // Étiquettes filtrées toujours visibles, même au-delà de la limite.
      const shownT = [...items.slice(0, max), ...items.slice(max).filter((t) => FS.tags[key].has(t))];
      const shown = shownT.map((t) => fChip(key, t, D.dict[TAG_KEYS[key]][t], false, "tag")).join("");
      const hidden = items.length - shownT.length;
      return (shown || `<span class="hint">aucun</span>`) + (hidden > 0 ? `<span class="hint"> +${hidden}</span>` : "");
    };
    const fmt = (x, unit = "") => (x ? `${x}${unit}` : "?");
    const sBreak = p
      ? `s = ${p[1].toFixed(3)} (${METRICS[state.metric].label}) · ${escapeHtml(breakdown(p[0], i))}`
      : "";
    const nb = neighbors(i).slice(0, Math.min(state.k, 50))
      .map(([j, s, g2]) => `<li data-i="${j}"${s < state.tau ? ' class="below"' : ""} data-help="` +
        escapeHtml(`Clic : recentrer sur ce jeu. Similarité s = ${s.toFixed(3)}` +
          (s < state.tau ? " (sous le seuil τ, absent du graphe)" : "") +
          (g2 !== undefined ? ` · pépite : s·q^β = ${g2.toFixed(3)}, note ${N[j].av.toFixed(1)}, ${N[j].r} avis` : "")) + `">` +
        `<span>${escapeHtml(label(j))}</span><span class="score">${s.toFixed(3)}</span></li>`)
      .join("") || `<li class="hint">aucun voisin avec ces filtres</li>`;

    // Extensions officielles BGG (noms seulement : elles ne sont pas dans les données) et jeux de la même gamme.
    const line = g.xl >= 0 ? N.map((_, j) => j).filter((j) => j !== i && N[j].xl === g.xl) : [];
    const exNames = g.x.map((t) => D.dict.exp[t]).sort((a, b) => a.localeCompare(b));
    const expBlock = `<h3 data-help="Extensions officielles listées par BGG (extensions de fans exclues). Les extensions ne sont pas des jeux de l'interface : noms seulement.">Extensions BGG (${exNames.length})</h3>` +
      (exNames.length ? `<details class="exp-list"><summary>${exNames.length > 1 ? "Afficher la liste" : escapeHtml(exNames[0])}</summary>` +
        `<ul>${exNames.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></details>` : `<span class="hint">aucune</span>`) +
      (line.length ? `<h3 data-help="Jeux qui partagent une extension avec celui-ci (même gamme compatible). « Sans extension » les écarte. Clic : recentrer.">Même gamme</h3>` +
        `<ol class="nb-list">${line.map((j) => `<li data-i="${j}"><span>${escapeHtml(label(j))}</span></li>`).join("")}</ol>` : "");
    const d = $("#details");
    d.hidden = false;
    d.innerHTML = `
      <h2>${escapeHtml(g.n)}</h2>
      ${collBtn(g)}
      <dl>
        <dt>Année</dt><dd>${g.y ?? "?"}</dd>
        <dt>Note BGG</dt><dd>${g.av.toFixed(2)} (moyenne) · ${g.b.toFixed(2)} (bayésienne) · ${g.r.toLocaleString("fr-FR")} avis</dd>
        <dt>Collections</dt><dd>${g.ow.toLocaleString("fr-FR")} possèdent · ${g.wi.toLocaleString("fr-FR")} souhaitent · ${g.tr.toLocaleString("fr-FR")} échangent</dd>
        <dt>Convoitise</dt><dd data-help="Souhaits / possédés, relatif à la médiane des jeux de l'interface (×1 = typique). Point vert : centile dans l'intervalle choisi.">×${Math.exp(BEH.wish.x[i] - BEH.wish.median).toFixed(2)} la médiane · centile ${Math.round(BEH.wish.pct[i])}${markWish(i) ? ' <span class="sig wish">dans l\'intervalle</span>' : ""}</dd>
        <dt>Revente</dt><dd data-help="À échanger / possédés, relatif à la médiane des jeux de l'interface (×1 = typique). Contour rouge : centile dans l'intervalle choisi.">×${Math.exp(BEH.trade.x[i] - BEH.trade.median).toFixed(2)} la médiane · centile ${Math.round(BEH.trade.pct[i])}${markTrade(i) ? ' <span class="sig trade">dans l\'intervalle</span>' : ""}</dd>
        <dt>Joueurs</dt><dd>${g.p[0] && g.p[1] ? (g.p[0] === g.p[1] ? g.p[0] : `${g.p[0]}–${g.p[1]}`) : "?"}</dd>
        <dt>Durée</dt><dd>${fmt(g.t, " min")}</dd>
        <dt>Âge minimal</dt><dd>${fmt(g.a, " ans")}</dd>
        <dt>Poids</dt><dd>${g.w ?? "non disponible"}</dd>
        <dt>Fiche</dt><dd><a href="https://boardgamegeek.com/boardgame/${g.id}" target="_blank" rel="noopener">BoardGameGeek</a></dd>
      </dl>
      ${p ? `<p class="kv">Atteint via ${escapeHtml(N[p[0]].n)} : ${sBreak}</p>` : ""}
      ${isCenter && !pass[i] ? `<p class="kv">Ce jeu ne passe pas les filtres (affiché car choisi).</p>` : ""}
      ${!isCenter ? `<p class="kv">Surlignées : communes avec ${escapeHtml(c.n)}</p>` : ""}
      <h3>Mécaniques</h3><div class="chips">${sharedChips("m", "mech")}</div>
      <h3>Catégories</h3><div class="chips">${sharedChips("c", "cat")}</div>
      <h3>Auteurs</h3><div class="chips">${addableChips("d")}</div>
      <h3>Illustrateurs</h3><div class="chips">${addableChips("ar")}</div>
      <h3>Éditeurs</h3><div class="chips">${addableChips("pu", 6)}</div>
      <h3>Familles</h3><div class="chips">${addableChips("f", 10)}</div>
      ${expBlock}
      <h3>${Math.min(state.k, 50)} plus proches voisins${state.k > 50 ? " (50 premiers affichés)" : ""}</h3>
      <ol class="nb-list">${nb}</ol>
      ${!isCenter ? `<p class="kv"><button type="button" id="recenter">Recentrer sur ce jeu</button></p>` : ""}`;
    d.querySelectorAll(".nb-list li[data-i]").forEach((li) => li.addEventListener("click", () => setCenter(+li.dataset.i)));
    d.querySelectorAll(".chip.fchip").forEach((ch) => {
      const toggle = () => {
        const k = ch.dataset.fk, t = +ch.dataset.ft;
        hideHelp();
        if (ch.dataset.kind === "req") {
          if (!FS.req[k].delete(t)) { FS.ban[k].delete(t); FS.req[k].add(t); }
          drawRequired();
        } else {
          if (!FS.tags[k].delete(t)) { if (k === "f") FS.ban.f.delete(t); FS.tags[k].add(t); }
          drawRequired();
          drawTagChips(k);
        }
        applyFilters(); // redessine le graphe et ce panneau
      };
      ch.addEventListener("click", toggle);
      ch.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    const rc = d.querySelector("#recenter");
    if (rc) rc.addEventListener("click", () => setCenter(i));
    const cb = d.querySelector("#coll-btn");
    if (cb) cb.addEventListener("click", () => { COLL.toggle(g.id); });
  }

  // --- Mes collections (web/collection-store.js, page collections.html) ---------------------------
  // Bouton dans les détails du jeu cliqué ; le compteur de l'en-tête et le bouton suivent les changements,
  // y compris ceux faits dans l'onglet « Mes collections ».
  const COLL = window.BGG_COLLECTION;
  function collBtn(g) {
    if (!COLL) return "";
    const on = COLL.has(g.id);
    const cs = on ? COLL.collectionsOf(g.id) : [];
    return `<p class="coll-row"><button type="button" id="coll-btn" class="coll-btn${on ? " on" : ""}" aria-pressed="${on}" ` +
      `data-help="${on ? "Ce jeu est dans tes jeux. Clic : le retirer (de toutes les collections)." : "Ajoute ce jeu à tes jeux : il apparaît dans « Nouveaux jeux » de l'onglet « Mes collections », à ranger par glisser-déposer."}">` +
      `${on ? "★ Dans mes collections" : "☆ Ajouter à mes collections"}</button>` +
      (on ? `<span class="coll-in">${cs.length ? cs.map((c) => `<span class="ctag${c.color ? " colored" : ""}"${c.color ? ` style="--cc:${c.color}"` : ""}>${escapeHtml(c.name)}</span>`).join("") : '<span class="hint">nouveau jeu, pas encore rangé</span>'}</span>` : "") +
      `</p>`;
  }
  function drawCollCount() {
    if (!COLL) return;
    const n = COLL.list().length;
    $("#coll-count").textContent = n || "";
  }
  // Export du graphe courant vers Mes collections (bouton à côté de « Liens croisés ») : tous les jeux affichés,
  // vers les nouveaux jeux, une collection existante ou une nouvelle collection.
  const xpop = $("#export-pop");
  function closeExport() { xpop.hidden = true; }
  function openExport() {
    if (!COLL || !current.level) return;
    hideHelp();
    const all = [...current.level.keys()];
    const ids = (pick ? all.filter((i) => pick.sel.has(i)) : all).map((i) => N[i].id);
    const have = new Set(COLL.list().map((x) => x.id));
    const fresh = ids.filter((id) => !have.has(id)).length;
    const colls = COLL.collections();
    const center = N[state.center].n;
    xpop.innerHTML = `
      <div class="xp-head"><p><b>${ids.length} jeu${ids.length > 1 ? "x" : ""}</b> ${pick ? `sélectionné${ids.length > 1 ? "s" : ""} sur ${all.length}` : "dans le graphe"} (${fresh} pas encore dans mes jeux)</p>
        <button type="button" class="xp-pick" data-help="Met en surbrillance les nodes du graphe : clic sur un node pour le sélectionner ou le désélectionner, puis « Exporter la sélection ».">${pick ? "Modifier la sélection" : "Choisir dans le graphe"}</button></div>
      ${ids.length ? "" : '<p class="hint">Aucun jeu sélectionné.</p>'}
      <button type="button" class="xp-opt" data-to="">Nouveaux jeux <span class="hint">(à ranger)</span></button>
      ${colls.length ? `<p class="xp-sub">Dans une collection</p>${colls.map((c) => {
        const n = ids.filter((id) => !c.games.includes(id)).length;
        return `<button type="button" class="xp-opt" data-to="${c.cid}"${c.color ? ` style="--cc:${c.color}"` : ""}>` +
          `<span class="xp-dot${c.color ? " colored" : ""}"></span>${escapeHtml(c.name)} <span class="hint">+${n}</span></button>`;
      }).join("")}` : ""}
      <p class="xp-sub">Nouvelle collection</p>
      <form class="xp-new"><input maxlength="60" value="${escapeHtml(`Voisins de ${center}`)}" aria-label="Nom de la nouvelle collection"><button type="submit">Créer</button></form>
      <p class="hint xp-foot">${pick ? "Seulement les nodes sélectionnés." : "Jeu choisi et tous ses voisins affichés."} Les jeux déjà présents ne sont pas dupliqués.</p>`;
    xpop.querySelector(".xp-pick").addEventListener("click", () => { closeExport(); startPick(); });
    if (!ids.length) xpop.querySelectorAll(".xp-opt, .xp-new button").forEach((b) => { b.disabled = true; });
    const done = (r, where) => {
      closeExport();
      endPick();
      $("#search-msg").classList.remove("err");
      $("#search-msg").textContent = `${ids.length} jeux exportés vers ${where} : ${r.added} nouveau${r.added > 1 ? "x" : ""} dans mes jeux` +
        (r.inColl !== undefined && where !== "Nouveaux jeux" ? `, ${r.inColl} ajouté${r.inColl > 1 ? "s" : ""} à la collection` : "") + ".";
    };
    xpop.querySelectorAll(".xp-opt").forEach((b) => b.addEventListener("click", () => {
      const cid = b.dataset.to || null;
      const r = COLL.addMany(ids, cid);
      done(r, cid ? `« ${colls.find((c) => c.cid === cid).name} »` : "Nouveaux jeux");
    }));
    xpop.querySelector(".xp-new").addEventListener("submit", (e) => {
      e.preventDefault();
      let name = e.target.querySelector("input").value.trim() || `Voisins de ${center}`;
      const taken = new Set(COLL.collections().map((c) => c.name.toLowerCase()));
      for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${name.replace(/ \(\d+\)$/, "")} (${k})`;
      const cid = COLL.createCollection(name);
      done(COLL.addMany(ids, cid), `« ${name} »`);
    });
    xpop.hidden = false;
    const r = $("#export-btn").getBoundingClientRect(), w = $("#graph-wrap").getBoundingClientRect();
    xpop.style.left = `${Math.max(4, r.left - w.left)}px`;
    xpop.style.top = `${r.bottom - w.top + 6}px`;
  }
  // Mode sélection (bouton « Choisir dans le graphe » de l'overlay Exporter) : tous les nodes sont sélectionnés au
  // départ ; un clic (dé)sélectionne un node ; la barre en bas du graphe exporte la sélection. Échap ou Annuler : sortir.
  // Nodes apparus ensuite (voisins, profondeur…) : sélectionnés par défaut.
  let pick = null; // {sel: Set(index de jeu), seen: Set}
  function startPick() {
    if (state.view !== "graph") setView("graph");
    const all = [...current.level.keys()];
    pick = { sel: new Set(all), seen: new Set(all) };
    applyPick();
  }
  function endPick() {
    if (!pick) return;
    pick = null;
    applyPick();
  }
  function togglePick(i) {
    if (!pick.sel.delete(i)) pick.sel.add(i);
    applyPick();
  }
  function applyPick() {
    const bar = $("#pick-bar");
    $("#graph-wrap").classList.toggle("picking", !!pick);
    gNodes.selectAll("g.node").classed("pick-on", (n) => !!pick && pick.sel.has(n.i)).classed("pick-off", (n) => !!pick && !pick.sel.has(n.i));
    bar.hidden = !pick;
    if (!pick) return;
    const all = current.level ? [...current.level.keys()] : [];
    for (const i of all) if (!pick.seen.has(i)) { pick.seen.add(i); pick.sel.add(i); }
    const n = all.filter((i) => pick.sel.has(i)).length;
    bar.innerHTML = `<span><b>${n}</b> / ${all.length} jeux sélectionnés · clic sur un node : (dé)sélectionner</span>` +
      `<button type="button" class="ghost" data-p="all">Tout</button><button type="button" class="ghost" data-p="none">Aucun</button>` +
      `<button type="button" data-p="export"${n ? "" : " disabled"}>Exporter la sélection ⇪</button>` +
      `<button type="button" class="ghost" data-p="cancel">Annuler</button>`;
    bar.querySelector('[data-p="all"]').addEventListener("click", () => { all.forEach((i) => pick.sel.add(i)); applyPick(); });
    bar.querySelector('[data-p="none"]').addEventListener("click", () => { pick.sel.clear(); applyPick(); });
    bar.querySelector('[data-p="export"]').addEventListener("click", (e) => { e.stopPropagation(); openExport(); });
    bar.querySelector('[data-p="cancel"]').addEventListener("click", endPick);
  }
  ["mousedown", "wheel", "click", "dblclick"].forEach((ev) => $("#pick-bar").addEventListener(ev, (e) => e.stopPropagation()));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pick && xpop.hidden) endPick(); }, true);

  $("#export-btn").addEventListener("click", (e) => { e.stopPropagation(); if (xpop.hidden) openExport(); else closeExport(); });
  document.addEventListener("mousedown", (e) => { if (!xpop.hidden && !xpop.contains(e.target) && e.target.id !== "export-btn" && !e.target.closest("#pick-bar")) closeExport(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeExport(); });
  ["mousedown", "wheel", "click", "dblclick"].forEach((ev) => xpop.addEventListener(ev, (e) => e.stopPropagation()));

  if (COLL) COLL.onChange(() => {
    drawCollCount();
    hideHelp();
    if (state.selected >= 0) select(state.selected);
  });
  drawCollCount();

  // --- Contrôles ------------------------------------------------------------------------------
  function setCenter(i) {
    if (pick) endPick();
    state.center = i;
    state.selected = i;
    $("#search").value = label(i);
    $("#search-msg").textContent = "";
    $("#search-msg").classList.remove("err");
    try { history.replaceState(null, "", `#${N[i].id}`); } catch (_) { /* file:// selon le navigateur */ }
    drawRequired();
    render(); // le zoom courant est conservé : render() replace le nouveau centre au milieu sans saut
    if (state.view === "map") focusMap();
  }
  function go() {
    const i = resolve($("#search").value);
    if (i < 0) {
      $("#search-msg").textContent = `Aucun jeu trouvé (seuls les ${N.length} jeux ayant au moins ${D.meta.min_ratings} avis sont inclus).`;
      $("#search-msg").classList.add("err");
      return;
    }
    setCenter(i);
  }
  $("#go").addEventListener("click", go);
  $("#search").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  $("#search").addEventListener("change", () => { if (byLabel.has($("#search").value.trim().toLowerCase())) go(); });

  // --- Voisins ↔ profondeur : budget W(k, d) = k + k² + … + k^d ≤ 300 (pire cas : chaque niveau entièrement nouveau) ---
  // Les deux curseurs sont indépendants tant que le budget tient ; au-delà, celui qu'on bouge pousse l'autre
  // (« butée ») : monter k fait descendre la profondeur, monter la profondeur fait descendre k.
  function drawKD(pushed) {
    $("#k").value = KS.indexOf(state.k);
    $("#depth").value = state.depth;
    $("#k-out").textContent = state.k;
    $("#depth-out").textContent = state.depth;
    // Aide au survol de la ligne : budget détaillé pour les réglages courants.
    $("#kd-msg").dataset.help = `Jeux affichés autour du jeu choisi / maximum possible avec ces réglages : au pire ` +
      `k + k² + … + k^profondeur = ${worst(state.k, state.depth)} jeux (chaque niveau entièrement nouveau), limité à ${BUDGET}. ` +
      `À profondeur ${state.depth} : voisins ≤ ${maxK(state.depth)} ; à ${state.k} voisins : profondeur ≤ ${maxDepth(state.k)}. ` +
      `Monter un curseur au-delà du budget fait descendre l'autre ; en pratique les voisins se recoupent, d'où moins de jeux. ` +
      `Les voisins sont cherchés parmi les seuls jeux qui passent les filtres.`;
    for (const id of ["k", "depth"]) {
      const out = $(`#${id}-out`);
      out.classList.remove("pushed");
      if (id === pushed) { void out.offsetWidth; out.classList.add("pushed"); } // relance l'animation
    }
  }
  $("#k").addEventListener("input", (e) => {
    state.k = KS[+e.target.value];
    let pushed = null;
    if (worst(state.k, state.depth) > BUDGET) { state.depth = maxDepth(state.k); pushed = "depth"; }
    drawKD(pushed);
    if (state.center >= 0) render();
  });
  $("#depth").addEventListener("input", (e) => {
    state.depth = +e.target.value;
    let pushed = null;
    if (worst(state.k, state.depth) > BUDGET) { state.k = maxK(state.depth); pushed = "k"; }
    drawKD(pushed);
    if (state.center >= 0) render();
  });
  drawKD(null);
  $("#cross").addEventListener("click", (e) => {
    state.cross = !state.cross;
    e.currentTarget.setAttribute("aria-pressed", state.cross);
    if (state.center >= 0) render();
  });
  // Panneau « Options » (haut de la colonne droite) : boutons bascule. setOpt(clé d'état, id du bouton, valeur).
  function setOpt(key, id, on) {
    state[key] = on;
    $(`#${id}`).setAttribute("aria-pressed", on);
  }
  for (const [key, id] of [["noReimpl", "no-reimpl"], ["noFranchise", "no-franchise"], ["noExpLine", "no-expline"]]) {
    $(`#${id}`).addEventListener("click", () => { setOpt(key, id, !state[key]); applyFilters(); });
  }
  $("#emoji").addEventListener("click", () => { setOpt("emoji", "emoji", !state.emoji); if (state.center >= 0) render(); });

  // Légende des émojis (repliable) : familles de mécaniques puis thèmes.
  {
    const fams = Object.values(EMO.families).map((f) =>
      `<li data-help="${escapeHtml(f.label + " : " + f.mechanics.join(", "))}"><span class="emo">${f.emoji}</span>${escapeHtml(f.label)}</li>`).join("");
    const byEmoji = new Map();
    for (const [name, e] of Object.entries(EMO.themes)) byEmoji.set(e, [...(byEmoji.get(e) || []), name]);
    const themes = [...byEmoji].map(([e, names]) =>
      `<li data-help="${escapeHtml(names.join(", "))}"><span class="emo">${e}</span>${escapeHtml(names.length > 1 ? names[0] + " (+" + (names.length - 1) + ")" : names[0])}</li>`).join("");
    $("#emoji-legend").innerHTML = `<h3>Familles de mécaniques</h3><ul class="emo-grid">${fams}</ul>` +
      `<h3>Thèmes</h3><ul class="emo-grid">${themes}</ul>`;
  }
  $("#signals").addEventListener("change", (e) => {
    state.signals = e.target.checked;
    $("#legend-signals").hidden = !state.signals;
    $("#sig-row").hidden = !state.signals;
    applyFilters(); // le filtre par signaux ne s'applique que si les signaux sont affichés
  });
  // Un curseur à deux poignées par signal : intervalle [bas, haut] de centiles. Raccourcis pour les cas courants.
  const SIG_PRESETS = {
    "keep": { wish: [80, 100], trade: [0, 30] },
    "flip": { wish: [80, 100], trade: [70, 100] },
    "cold": { wish: [0, 20], trade: [0, 100] },
    "all": { wish: [0, 100], trade: [0, 100] },
  };
  function drawSig() {
    const fmt = (k) => (sigActive(k) ? `c${sigInt[k][0]} → c${sigInt[k][1]}` : "tous");
    for (const k of ["wish", "trade"]) {
      const [lo, hi] = sigInt[k];
      $(`#${k}-lo`).value = lo; $(`#${k}-hi`).value = hi;
      // Poignées superposées : à droite, la poignée basse passe dessus (sinon bloquée sous la haute en 100/100).
      $(`#${k}-lo`).style.zIndex = lo > 50 ? 3 : 1;
      $(`#${k}-out`).textContent = fmt(k);
      const box = $(`#${k}-int`);
      box.style.setProperty("--lo", `${lo}%`); box.style.setProperty("--hi", `${hi}%`);
      box.classList.toggle("inactive", !sigActive(k));
    }
    const n = (f) => N.reduce((a, _, i) => a + (f(i) ? 1 : 0), 0);
    const both = n((i) => ["wish", "trade"].every((k) => !sigActive(k) || inInt(k, i)));
    $("#sig-count").textContent = (sigActive("wish") || sigActive("trade"))
      ? `${both} jeux dans les intervalles actifs` : "aucun intervalle actif : glisse une poignée";
    document.querySelectorAll(".sig-preset").forEach((b) => {
      const P = SIG_PRESETS[b.dataset.p];
      b.classList.toggle("on", ["wish", "trade"].every((k) => P[k][0] === sigInt[k][0] && P[k][1] === sigInt[k][1]));
    });
  }
  let sgt;
  const sigChanged = () => {
    drawSig();
    clearTimeout(sgt);
    sgt = setTimeout(() => { if (FS.sigFilter) applyFilters(); else if (state.center >= 0) render(); }, 120);
  };
  for (const k of ["wish", "trade"]) {
    $(`#${k}-lo`).addEventListener("input", (e) => { sigInt[k][0] = Math.min(+e.target.value, sigInt[k][1]); sigChanged(); });
    $(`#${k}-hi`).addEventListener("input", (e) => { sigInt[k][1] = Math.max(+e.target.value, sigInt[k][0]); sigChanged(); });
  }
  document.querySelectorAll(".sig-preset").forEach((b) => b.addEventListener("click", () => {
    const P = SIG_PRESETS[b.dataset.p];
    for (const k of ["wish", "trade"]) sigInt[k] = [...P[k]];
    hideHelp();
    sigChanged();
  }));
  $("#sig-filter").addEventListener("change", (e) => { FS.sigFilter = e.target.checked; applyFilters(); });
  drawSig();

  // Curseurs de note : pas de 0,1 (valeurs ×10 dans les <input range>).
  function drawRate(k) {
    const R = FS.rate[k], box = $(`#${k}-int`);
    $(`#${k}-lo`).value = Math.round(R.lo * 10); $(`#${k}-hi`).value = Math.round(R.hi * 10);
    $(`#${k}-lo`).style.zIndex = R.lo > (R.min + R.max) / 2 ? 3 : 1;
    const pos = (v) => `${(100 * (v - R.min)) / (R.max - R.min)}%`;
    box.style.setProperty("--lo", pos(R.lo)); box.style.setProperty("--hi", pos(R.hi));
    box.classList.toggle("inactive", !rateActive(k));
    $(`#${k}-out`).textContent = rateActive(k) ? `${R.lo.toFixed(1)} → ${R.hi.toFixed(1)}` : "toutes";
  }
  let rtm;
  for (const k of ["av", "b"]) {
    const R = FS.rate[k];
    for (const end of ["lo", "hi"]) {
      const el = $(`#${k}-${end}`);
      el.min = Math.round(R.min * 10); el.max = Math.round(R.max * 10); el.step = 1;
      el.addEventListener("input", (e) => {
        const v = e.target.value / 10;
        if (end === "lo") R.lo = Math.min(v, R.hi); else R.hi = Math.max(v, R.lo);
        drawRate(k);
        clearTimeout(rtm);
        rtm = setTimeout(applyFilters, 150);
      });
    }
    drawRate(k);
  }
  // --- Curseurs doubles : glisser la bande entre les deux poignées déplace tout l'intervalle ---------------
  // Largeur (haut − bas) conservée ; l'intervalle bute sur les bords. Les poignées gardent leur rôle habituel
  // (web/ui/dual-range.js)
  for (const k of ["wish", "trade"]) {
    createBandDrag($(`#${k}-int`), { onStart: hideHelp, min: 0, max: 100, step: 1, get: () => [...sigInt[k]],
      set: (lo, hi) => { sigInt[k] = [lo, hi]; sigChanged(); } });
  }
  for (const k of ["av", "b"]) {
    createBandDrag($(`#${k}-int`), { onStart: hideHelp, min: FS.rate[k].min, max: FS.rate[k].max, step: 0.1, get: () => [FS.rate[k].lo, FS.rate[k].hi],
      set: (lo, hi) => { FS.rate[k].lo = lo; FS.rate[k].hi = hi; drawRate(k); clearTimeout(rtm); rtm = setTimeout(applyFilters, 150); } });
  }

  document.querySelectorAll(".view-btn[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#fam-center").addEventListener("click", () => {
    state.famCenter = state.famCenter === "peak" ? "mean" : "peak";
    hideHelp();
    if (state.center >= 0) render();
  });
  $("#fam-btn").addEventListener("click", () => {
    state.famView = !state.famView;
    if (!state.famView) state.famOpen = null;
    hideHelp();
    if (state.center >= 0) render();
  });
  msvg.on("click", () => { if (state.center >= 0) select(state.center); });
  $("#gems-btn").addEventListener("click", () => {
    state.gems = !state.gems;
    $("#gems-btn").setAttribute("aria-pressed", state.gems);
    $("#gem-row").hidden = !state.gems;
    invalidate();
  });
  let gt;
  $("#gem-beta").addEventListener("input", (e) => {
    $("#gem-beta-out").textContent = (e.target.value / 100).toFixed(1).replace(".", ",");
    clearTimeout(gt);
    gt = setTimeout(() => { state.gemBeta = e.target.value / 100; if (state.gems) invalidate(); }, 120);
  });
  // Boutons d'affichage posés en haut à gauche du graphe : note écrite dans les bulles, couleur = note.
  $("#show-rating").addEventListener("click", (e) => {
    state.showRating = !state.showRating;
    e.currentTarget.setAttribute("aria-pressed", state.showRating);
    if (state.center >= 0) render();
  });
  $("#color-rating").addEventListener("click", (e) => {
    state.colorRating = !state.colorRating;
    e.currentTarget.setAttribute("aria-pressed", state.colorRating);
    $("#legend-rating").hidden = !state.colorRating;
    if (state.center >= 0) render();
  });
  $("#legend-rating .gradient").style.background =
    `linear-gradient(to right, ${d3.range(0, 1.01, 0.1).map((t) => d3.interpolateViridis(t)).join(", ")})`;

  // --- Pondération des attributs : quatre curseurs normalisés -------------------------------------------
  //   v_k ∈ [0, 100] par attribut, w_k = v_k / Σ v. La ligne des pourcentages (w_k) reste toujours visible ;
  //   la case « Curseurs » affiche les curseurs. Clic sur un pourcentage : cet attribut seul.
  const pct = (x) => `${Math.round(x * 100)} %`;
  function drawWeights() {
    const w = attrWeights();
    for (const k of ATTR_KEYS) $(`#w-${k}`).value = state.wRaw[k];
    $("#weights").innerHTML = ATTR_KEYS.map((k) =>
      `<span class="wchip${w[k] > 0 ? "" : " zero"}" data-k="${k}" role="button" tabindex="0" ` +
      `data-help="Poids de « ${ATTRS[k].label} » dans la ressemblance totale. Clic : ne garder que cet attribut.">` +
      `${ATTRS[k].label} <b>${pct(w[k])}</b></span>`).join("");
    $("#weights").querySelectorAll(".wchip").forEach((el) => {
      const solo = () => { hideHelp(); soloAttr(el.dataset.k); };
      el.addEventListener("click", solo);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); solo(); } });
    });
  }
  for (const k of ATTR_KEYS) {
    let tm;
    $(`#w-${k}`).addEventListener("input", (e) => {
      let v = +e.target.value;
      // Au moins un attribut pondéré : le dernier curseur non nul ne descend pas à 0.
      if (v === 0 && ATTR_KEYS.every((x) => x === k || state.wRaw[x] === 0)) v = 1;
      state.wRaw[k] = v;
      drawWeights();
      clearTimeout(tm);
      tm = setTimeout(() => invalidate(), 120);
    });
  }
  $("#show-sliders").addEventListener("change", (e) => { $("#wsliders").hidden = !e.target.checked; });
  drawWeights();

  // τ : seuil appliqué après le top-k, sans recalcul des voisins.
  $("#tau").addEventListener("input", (e) => {
    state.tau = e.target.value / 100;
    $("#tau-out").textContent = `${Math.round(state.tau * 100)} %`;
    if (state.center >= 0) render();
  });

  let ft;
  for (const id of ["f-kw", "pl-min", "pl-max", "t-min", "t-max", "age-max", "w-min", "w-max"]) {
    $(`#${id}`).addEventListener("input", () => { clearTimeout(ft); ft = setTimeout(applyFilters, 250); });
  }
  $("#reset").addEventListener("click", () => {
    for (const id of ["f-kw", "pl-min", "pl-max", "t-min", "t-max", "age-max", "w-min", "w-max"]) $(`#${id}`).value = "";
    for (const k of Object.keys(TAG_KEYS)) { FS.tags[k].clear(); drawTagChips(k); }
    setOpt("noFranchise", "no-franchise", false);
    setOpt("noReimpl", "no-reimpl", false);
    setOpt("noExpLine", "no-expline", false);
    $("#sig-filter").checked = FS.sigFilter = false;
    for (const k of ["av", "b"]) { FS.rate[k].lo = FS.rate[k].min; FS.rate[k].hi = FS.rate[k].max; drawRate(k); }
    // « Garder / exclure » n'est pas touché : il a son propre bouton « Effacer ».
    applyFilters();
  });
  $("#req-clear").addEventListener("click", () => {
    clearReqBan(); drawRequired();
    applyFilters();
  });

  svg.on("click", () => { if (!pick && state.center >= 0) select(state.center); });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => state.center >= 0 && render(), 200); });

  // Légende et méta-données
  $("#legend-depth").innerHTML = [0, 1, 2, 3, 4]
    .map((d) => `<li><span class="dot" style="background:${depthColor(d)}"></span>${d === 0 ? "jeu choisi" : `niveau ${d}`}</li>`)
    .join("");
  $("#meta").textContent = `${N.length} jeux (≥ ${D.meta.min_ratings} avis) · cosinus IDF lissé (étiquettes de moins de ` +
    `${D.meta.min_support} jeux ignorées) · source : ${D.meta.source} · généré le ${D.meta.generated}. ` +
    `Données BoardGameGeek, usage non commercial.`;

  // --- Overlay des filtres actifs (survol du mot « Filtres ») ------------------------------------------
  // Liste chaque filtre en place (y compris « Garder / exclure »), avec ✕ pour le retirer.
  function activeFilters() {
    const out = [];
    const add = (group, text, clear, cls = "") => out.push({ group, text, clear, cls });
    const TAG_NAMES = { f: "Famille", d: "Auteur", ar: "Illustrateur", pu: "Éditeur" };
    for (const key of Object.keys(TAG_KEYS)) for (const t of FS.tags[key]) {
      add("Filtres", `${TAG_NAMES[key]} : ${D.dict[TAG_KEYS[key]][t]}`, () => { FS.tags[key].delete(t); drawTagChips(key); });
    }
    const F = readFilters();
    if (F.kw.length) add("Filtres", `Mots-clés : « ${$("#f-kw").value.trim()} »`, () => { $("#f-kw").value = ""; });
    const span = (lo, hi, unit = "") => (lo !== null && hi !== null ? `${fr(lo)} à ${fr(hi)}${unit}`
      : lo !== null ? `≥ ${fr(lo)}${unit}` : `≤ ${fr(hi)}${unit}`);
    const clearIds = (...ids) => () => ids.forEach((id) => { $(`#${id}`).value = ""; });
    if (F.nums.plMin !== null || F.nums.plMax !== null) add("Filtres", `Joueurs : ${span(F.nums.plMin, F.nums.plMax)}`, clearIds("pl-min", "pl-max"));
    if (F.nums.tMin !== null || F.nums.tMax !== null) add("Filtres", `Durée : ${span(F.nums.tMin, F.nums.tMax, " min")}`, clearIds("t-min", "t-max"));
    if (F.nums.ageMax !== null) add("Filtres", `Âge ≤ ${F.nums.ageMax} ans`, clearIds("age-max"));
    if (F.nums.wMin !== null || F.nums.wMax !== null) add("Filtres", `Poids : ${span(F.nums.wMin, F.nums.wMax)}`, clearIds("w-min", "w-max"));
    for (const [k, name] of [["av", "Note BGG"], ["b", "Note bayésienne"]]) {
      if (rateActive(k)) add("Filtres", `${name} : ${fr(FS.rate[k].lo.toFixed(1))} à ${fr(FS.rate[k].hi.toFixed(1))}`,
        () => { FS.rate[k].lo = FS.rate[k].min; FS.rate[k].hi = FS.rate[k].max; drawRate(k); });
    }
    if (FS.noFranchise) add("Filtres", "Sans franchise", () => setOpt("noFranchise", "no-franchise", false));
    if (FS.noReimpl) add("Filtres", "Sans réimplémentation", () => setOpt("noReimpl", "no-reimpl", false));
    if (FS.noExpLine) add("Filtres", "Sans extension (même gamme)", () => setOpt("noExpLine", "no-expline", false));
    if (state.signals && FS.sigFilter && (sigActive("wish") || sigActive("trade"))) {
      const iv = (k) => `c${sigInt[k][0]}–c${sigInt[k][1]}`;
      const parts = [sigActive("wish") ? `convoitise ${iv("wish")}` : null, sigActive("trade") ? `revente ${iv("trade")}` : null];
      add("Filtres", `Signaux : ${parts.filter(Boolean).join(", ")}`, () => { $("#sig-filter").checked = FS.sigFilter = false; });
    }
    for (const key of ATTR_KEYS) {
      for (const t of FS.req[key]) add("Garder / exclure", `✓ ${ATTRS[key].dict[t]} (${ATTRS[key].short})`,
        () => { FS.req[key].delete(t); drawRequired(); });
      for (const t of FS.ban[key]) add("Garder / exclure", `✕ ${ATTRS[key].dict[t]} (${ATTRS[key].short})`,
        () => { FS.ban[key].delete(t); drawRequired(); }, "ban");
    }
    return out;
  }
  const fpop = $("#filter-pop");
  function drawFilterPop() {
    const list = activeFilters();
    const nPass = pass.reduce((a, b) => a + b, 0);
    const groups = [...new Set(list.map((x) => x.group))];
    fpop.innerHTML = (list.length
      ? groups.map((gname) => `<h4>${gname}</h4><ul>` + list.map((x, j) => (x.group === gname
        ? `<li><span class="${x.cls}">${escapeHtml(x.text)}</span><button type="button" data-j="${j}" aria-label="Retirer ce filtre">✕</button></li>` : ""))
        .join("") + "</ul>").join("")
      : "<h4>Aucun filtre actif</h4>") +
      `<p>${nPass} / ${N.length} jeux passent les filtres. Les voisins sont cherchés parmi eux ; le jeu choisi reste ` +
      `toujours affiché (contour pointillé s'il ne passe pas).</p>`;
    fpop.querySelectorAll("button[data-j]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      list[+b.dataset.j].clear();
      applyFilters();
      drawFilterPop();
    }));
  }
  {
    const sum = $("#filters-sum");
    let ht;
    const open = () => {
      clearTimeout(ht);
      drawFilterPop();
      fpop.hidden = false;
      const r = sum.getBoundingClientRect();
      fpop.style.left = `${Math.min(r.left, window.innerWidth - fpop.offsetWidth - 8)}px`;
      fpop.style.top = `${Math.min(r.bottom + 4, window.innerHeight - fpop.offsetHeight - 8)}px`;
    };
    const close = () => { ht = setTimeout(() => { fpop.hidden = true; }, 200); };
    sum.addEventListener("mouseenter", open);
    sum.addEventListener("mouseleave", close);
    fpop.addEventListener("mouseenter", () => clearTimeout(ht));
    fpop.addEventListener("mouseleave", close);
    window.addEventListener("scroll", (e) => { if (!fpop.contains(e.target)) fpop.hidden = true; }, true);
  }

  // --- Comparateur : accord entre métriques, puis entre attributs ---------------------------------------
  // Pour le jeu central : A[a][b] = |V_k^a ∩ V_k^b| / k (voisins communs, mêmes filtres, sans le mode pépites).
  //   métriques : les 4 métriques avec la pondération courante ; attributs : chaque attribut seul, métrique courante.
  // Consensus : jeux présents dans le top-k d'au moins la moitié des 8 configurations.
  const sel = $("#metric");
  sel.innerHTML = METRIC_KEYS.map((m) => `<option value="${m}">${METRICS[m].label}</option>`).join("");
  const metricHelp = () => `Métrique appliquée à chaque attribut : ${METRICS[state.metric].help}`;
  $("#metric-tool").dataset.help = metricHelp();
  function setMetric(m) {
    state.metric = m;
    sel.value = m;
    $("#metric-tool").dataset.help = metricHelp();
    invalidate();
  }
  sel.addEventListener("change", () => setMetric(sel.value));
  // Faire d'un attribut le seul critère (clic dans la matrice des attributs).
  function soloAttr(key) {
    for (const k of ATTR_KEYS) state.wRaw[k] = k === key ? 100 : 0;
    drawWeights();
    invalidate();
  }

  function agreementTable(confs, cur, onClick, k) {
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);
    const head = confs.map((c) => `<th scope="col" data-help="${escapeHtml(c.help)}">${c.short}</th>`).join("");
    const rows = confs.map((a) => `<tr${a.id === cur ? ' class="cur"' : ""}>` +
      `<th scope="row" data-id="${a.id}" data-help="${escapeHtml(onClick.help(a))}">${a.short}</th>` +
      confs.map((b) => {
        if (!a.top.length && !b.top.length) return "<td>–</td>";
        const B = new Set(b.top);
        const v = a.top.filter((x) => B.has(x)).length / k;
        const bg = color(0.15 + 0.85 * v);
        return `<td style="background:${bg};color:${textOn(bg)}" data-help="${escapeHtml(
          `${a.label} et ${b.label} : ${Math.round(v * k)} voisin(s) commun(s) sur ${k}.`)}">${Math.round(v * 100)}</td>`;
      }).join("") + "</tr>").join("");
    return `<table class="agree"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function drawAgreement() {
    const box = $("#agree");
    if (state.center < 0 || box.closest("details").open === false) return;
    const u = state.center, k = Math.min(state.k, 30), base = currentCfg(); // top 30 au plus : matrices lisibles
    const top = (cfg) => neighbors(u, cfg, false).slice(0, k).map((x) => x[0]);
    const { mConfs, aConfs } = agreementConfigs({ ATTRS, ATTR_KEYS, base, top });
    const w = attrWeights();
    const curAttr = ATTR_KEYS.find((x) => w[x] === 1);
    const { all, half, cons } = consensus(mConfs, aConfs);
    box.innerHTML = `
      <h3 data-help="Les 4 métriques avec la pondération courante des attributs.">Métriques</h3>
      ${agreementTable(mConfs, state.metric, { help: (a) => `Clic : utiliser la métrique « ${a.label} ».` }, k)}
      <h3 data-help="Chaque attribut pris seul, avec la métrique courante (${escapeHtml(METRICS[state.metric].label)}).">Attributs</h3>
      ${agreementTable(aConfs, curAttr, { help: (a) => `Clic : ne garder que « ${a.label} » comme critère.` }, k)}
      <p class="hint">Case = % de voisins communs (top ${k}) pour ${escapeHtml(N[u].n)}.</p>
      <h3 data-help="Jeux présents dans le top ${k} d'au moins ${half} des ${all.length} configurations (4 métriques + 4 attributs seuls) : recommandations robustes.">Consensus (≥ ${half}/${all.length})</h3>
      <ol class="nb-list">${cons.map(([v, c]) => `<li data-i="${v}" data-help="${escapeHtml(`Clic : recentrer. Présent pour ${c.n} configurations : ${c.ms.join(", ")} ; rang moyen ${(c.rk / c.n).toFixed(1)}.`)}">` +
        `<span>${escapeHtml(label(v))}</span><span class="score">${c.n}/${all.length}</span></li>`).join("")
        || '<li class="hint">aucun jeu commun à la moitié des configurations</li>'}</ol>`;
    const tables = box.querySelectorAll("table.agree");
    tables[0].querySelectorAll("th[data-id]").forEach((th) => th.addEventListener("click", () => { hideHelp(); setMetric(th.dataset.id); }));
    tables[1].querySelectorAll("th[data-id]").forEach((th) => th.addEventListener("click", () => { hideHelp(); soloAttr(th.dataset.id); }));
    box.querySelectorAll("li[data-i]").forEach((li) => li.addEventListener("click", () => { hideHelp(); setCenter(+li.dataset.i); }));
  }
  $("#agree-box").addEventListener("toggle", drawAgreement);

  // Jeu initial : id BGG dans l'URL (#30549), sinon Terraforming Mars, sinon le plus noté.
  const fromHash = N.findIndex((g) => String(g.id) === location.hash.slice(1));
  applyFilters(); // filtres actifs dès le départ (signaux « Convoité, gardé » filtrés par défaut)
  const byDefault = resolve("Terraforming Mars"); // jeu affiché par défaut
  setCenter(fromHash >= 0 ? fromHash : byDefault >= 0 ? byDefault : 0);
  // Onglet nommé : les liens « Explorer » de la page « Mes collections » (target="bga-explorer") rouvrent cet onglet,
  // avec #id BGG dans l'adresse : on recentre sur ce jeu.
  window.name = "bga-explorer";
  // Temporaire (refactoring, étapes 2-3) : exposé pour comparer ce calcul à web/lib/ ; retiré à l'étape 10.
  window.__dbg = { neighbors: (u, cfg) => neighbors(u, cfg, false), getPass: () => pass, state };
  window.addEventListener("hashchange", () => {
    const j = N.findIndex((g) => String(g.id) === location.hash.slice(1));
    if (j >= 0 && j !== state.center) setCenter(j);
  });
})();
