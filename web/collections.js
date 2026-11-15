/* Page « Mes collections » (web/collection-store.js pour le modèle).
 *   1re colonne : filtres (nom, notes, joueurs, durée, âge, année, mécaniques, thème, auteur, éditeur)
 *   2e : nouveaux jeux (ajoutés depuis l'explorateur, rangés nulle part ; deux colonnes de fiches) ; « Tous mes jeux »
 *   3e : collections créées par l'utilisateur (créer, renommer, supprimer)
 *   4e : détails du jeu cliqué ; clic sur une de ses étiquettes = surbrillance des jeux qui l'ont
 * Glisser-déposer (HTML5) : gauche -> collection = ranger ; collection -> collection = déplacer (Ctrl/Alt : copier) ;
 * collection -> gauche = sortir de cette collection.
 */
import { TAG_KEYS, TAG_NAMES } from "./lib/dataset.js";
import { createKeywordText } from "./lib/keywords.js";
import { createFilterState, passes as passesL, filterCount as filterCountL, reqBanCount, rateActive as rateActiveL, setKeywords, includeTag, excludeTag, isIncluded as isIncludedL, isExcluded as isExcludedL } from "./lib/filters.js";
import { escapeHtml as esc } from "./ui/html.js";
import { installHelp } from "./ui/help-tooltip.js";
import { createFilterPanel } from "./ui/filter-panel/filter-panel.js";
import { serializeUI, deserializeUI, UI_KEY } from "./lib/ui-persistence.js";

(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  // Aide au survol (data-help, après 400 ms ; masquée pendant un glisser) : web/ui/help-tooltip.js.
  const { hide: hideHelp } = installHelp({ el: $("#help"), delay: 400, isSuppressed: () => dragging });
  const D = window.BGG_DATA, COLL = window.BGG_COLLECTION, EMO = window.BGG_EMOJI || { themes: {}, families: {} };
  if (!D || !COLL) {
    $("#coll-msg").textContent = !D ? "Données absentes : lancer python3 src/export_web.py." : "collection-store.js manquant.";
    $("#coll-msg").classList.add("err");
    return;
  }
  const byId = new Map(D.nodes.map((g) => [g.id, g]));
  const nonThematic = new Set(EMO.nonThematic || []);
  // Émoji du thème dominant : catégorie thématique la plus spécifique (IDF maximal), comme dans l'explorateur.
  const domEmo = (g) => {
    const th = g.c.filter((t) => !nonThematic.has(D.dict.cat[t]));
    const c = (th.length ? th : g.c).reduce((b, t) => (b === null || D.idf.cat[t] > D.idf.cat[b] ? t : b), null);
    return c !== null ? EMO.themes[D.dict.cat[c]] || "" : "";
  };
  const players = (p) => (p[0] && p[1] ? (p[0] === p[1] ? `${p[0]} j.` : `${p[0]}–${p[1]} j.`) : "? j.");
  const SORTS = {
    added: (a, b) => (b.added || "").localeCompare(a.added || ""),
    name: (a, b) => (a.g ? a.g.n : "").localeCompare(b.g ? b.g.n : ""),
    av: (a, b) => (b.g ? b.g.av : 0) - (a.g ? a.g.av : 0),
    y: (a, b) => (b.g ? b.g.y || 0 : 0) - (a.g ? a.g.y || 0 : 0),
    t: (a, b) => (a.g ? a.g.t || 1e9 : 1e9) - (b.g ? b.g.t || 1e9 : 1e9),
  };

  // --- Filtres (1re colonne) : mêmes filtres que l'explorateur (web/app.js), appliqués à mes jeux --------------
  //   Garder / exclure : toutes les étiquettes (mécaniques, thème, familles fines) de mes jeux, par fréquence ;
  //     clic = indispensable (✓), croix au survol = interdite (✕) ; « + » affiche toutes les étiquettes.
  //   Notes BGG et bayésienne : curseurs à deux poignées (glisser la bande déplace l'intervalle).
  //   Joueurs, durée, âge, poids ; famille, auteur, illustrateur, éditeur (au moins un des choix).
  const FAM_SKIP_F = /^(Admin|Crowdfunding|Digital Implementations|Game|Versions & Editions|Misc):/;
  const REQ = { m: { dict: "mech", label: "Méca." }, c: { dict: "cat", label: "Thème" }, f: { dict: "fam", label: "Familles" } };
  const REQ_SHOW = 12; // étiquettes visibles par rubrique avant « + »
  // Filtres : état unique (web/lib/filters.js), alias courts vers ses parties.
  const FS = createFilterState({ reqKeys: ["m", "c", "f"] });
  const { req, ban, tags, notTags, modeReq, modeTag } = FS;
  const expanded = { m: false, c: false, f: false };
  const RATE = FS.rate;
  const rateActive = (k) => rateActiveL(FS, k);
  const NUM_IDS = ["pl-min", "pl-max", "t-min", "t-max", "age-max", "w-min", "w-max"]; // champs numériques (même ordre que FS.nums)
  const NUM_STATE = ["plMin", "plMax", "tMin", "tMax", "ageMax", "wMin", "wMax"];
  const mine = () => COLL.list().map((x) => byId.get(x.id)).filter(Boolean);
  // Panneau Filtres : web/ui/filter-panel/ (balisage, curseurs de note, champs d'étiquettes, saisie anti-rebond).
  // « ＋ Collection avec ces jeux » s'insère sous la recherche par mots-clés.
  const F_SAVE_HTML = `
      <div id="f-save" class="f-save">
        <button type="button" id="f-save-btn" class="secondary" data-help="Crée une nouvelle collection avec tous tes jeux qui passent les filtres actifs (nouveaux jeux et collections confondus). Les jeux restent aussi là où ils sont.">＋ Collection avec ces jeux</button>
        <form id="f-save-form" class="new-coll" hidden>
          <input id="f-save-name" maxlength="60" autocomplete="off" aria-label="Nom de la nouvelle collection">
          <button type="submit">Créer</button>
        </form>
      </div>
`;
  const panel = createFilterPanel($("#filter-panel"), { mode: "collections", D, F: FS, hideHelp, debounce: 200,
    onChange: () => draw(), afterKeywords: F_SAVE_HTML,
    suggestions: (k) => {
      const freq = new Map();
      mine().forEach((g) => g[k].forEach((t) => freq.set(t, (freq.get(t) || 0) + 1)));
      return [...freq].sort((a, b) => b[1] - a[1]);
    } });
  const reqTerms = (g, k) => (k === "f" ? g.f.filter((t) => !FAM_SKIP_F.test(D.dict.fam[t])) : g[k]);

  // Recherche par mots-clés (web/lib/keywords.js) ; prédicat unique web/lib/filters.js.
  const kwText = createKeywordText(D);
  const passCtx = { kwText: (g) => kwText(g), terms: (g, i, key) => new Set(g[key]) };
  function readF() {
    panel.readInputs();
    const F = { kw: FS.kw };
    NUM_IDS.forEach((id, j) => { F[id] = FS.nums[NUM_STATE[j]]; });
    return F;
  }
  const passes = (g, F) => (g ? passesL(g, 0, FS, passCtx) : !F.active); // jeu absent des données : visible seulement sans filtre
  const nReqBan = () => reqBanCount(FS);
  const filterCount = () => filterCountL(FS, { reqInCount: true });
  // Garder / exclure : pastilles à trois états, sur toutes les étiquettes de mes jeux.
  function drawRequired() {
    const G = mine();
    // Compteur de chaque étiquette : nombre de mes jeux qui passent les filtres actifs et l'ont (0 = estompée).
    // L'ordre reste celui de la fréquence sur tous mes jeux, pour que les pastilles ne sautent pas.
    const F = readF();
    F.active = filterCount(F) > 0;
    const GF = F.active ? G.filter((g) => passes(g, F)) : G;
    for (const k of Object.keys(REQ)) {
      const freq = new Map(), cnt = new Map();
      G.forEach((g) => reqTerms(g, k).forEach((t) => freq.set(t, (freq.get(t) || 0) + 1)));
      GF.forEach((g) => reqTerms(g, k).forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1)));
      const order = [...freq].sort((a, b) => b[1] - a[1] || D.dict[REQ[k].dict][a[0]].localeCompare(D.dict[REQ[k].dict][b[0]])).map((x) => x[0]);
      const active = new Set([...req[k], ...ban[k]]);
      const shown = expanded[k] ? order : order.slice(0, REQ_SHOW);
      const extra = [...active].filter((t) => !shown.includes(t)); // actives toujours visibles
      const more = order.length - shown.length;
      const box = $(`#req-${k}`);
      box.innerHTML = [...shown, ...extra].map((t) => {
        const st = req[k].has(t) ? "on" : ban[k].has(t) ? "ban" : "";
        const name = D.dict[REQ[k].dict][t];
        const help = st === "on" ? "Indispensable : chaque jeu affiché doit l'avoir. Clic : revenir à neutre ; croix : l'interdire."
          : st === "ban" ? "Interdite : aucun jeu affiché ne doit l'avoir. Clic ou croix : revenir à neutre."
            : "Neutre. Clic : la rendre indispensable ; croix à droite : l'interdire.";
        const em = k === "m" ? mechEmo(name) : k === "c" ? EMO.themes[name] || "" : "";
        const n = cnt.get(t) || 0, tot = freq.get(t) || 0;
        const nTxt = F.active ? `${n} des ${GF.length} jeux affichés (${tot} de tous tes jeux)` : `${tot} de tes jeux`;
        return `<span class="chip toggle${st ? ` ${st}` : ""}${n ? "" : " zero"}" data-t="${t}" role="button" tabindex="0" data-help="${esc(`${help} (${nTxt})`)}">` +
          `${em ? `<span class="emo">${em}</span>` : ""}${esc(name)} <span class="cnt">${n}</span>` +
          `<span class="ban-x" aria-label="Interdire" data-help="${st === "ban" ? "Retirer l'interdiction." : "Interdire : aucun jeu affiché ne doit l'avoir."}">✕</span></span>`;
      }).join("") + (more > 0 ? `<span class="chip more" data-more="${k}" role="button" tabindex="0" data-help="Afficher les ${order.length} étiquettes.">+ ${more}</span>`
        : expanded[k] && order.length > REQ_SHOW ? `<span class="chip more" data-more="${k}" role="button" tabindex="0" data-help="N'afficher que les ${REQ_SHOW} plus fréquentes.">−</span>` : "")
        || '<span class="hint">aucune</span>';
      box.querySelectorAll(".chip.toggle").forEach((ch) => {
        const t = +ch.dataset.t;
        const toggleReq = () => { if (!ban[k].delete(t)) { if (!req[k].delete(t)) req[k].add(t); } hideHelp(); draw(); };
        const toggleBan = () => { if (!ban[k].delete(t)) { req[k].delete(t); if (k === "f") tags.f.delete(t); ban[k].add(t); } hideHelp(); draw(); };
        ch.addEventListener("click", (e) => (e.target.closest(".ban-x") ? toggleBan() : toggleReq()));
        ch.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleReq(); }
          else if (e.key === "Delete" || e.key === "Backspace" || e.key === "x") { e.preventDefault(); toggleBan(); }
        });
      });
      const mb = box.querySelector(".chip.more");
      if (mb) {
        const go = () => { expanded[k] = !expanded[k]; hideHelp(); drawRequired(); };
        mb.addEventListener("click", go);
        mb.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      }
    }
    $("#req-count").textContent = nReqBan() || "";
    // Une rubrique repliée qui contient un filtre actif se rouvre (filtre posé depuis le jeu affiché, par ex.).
    for (const k of Object.keys(REQ)) if (req[k].size || ban[k].size) { const d = document.querySelector(`details.req-sec[data-sec="${k}"]`); if (d && !d.open) d.open = true; }
    for (const k of Object.keys(REQ)) {
      const n = new Set(mine().flatMap((g) => reqTerms(g, k))).size, a = req[k].size + ban[k].size;
      $(`#sec-n-${k}`).textContent = a ? `${n} · ${a} actif${a > 1 ? "s" : ""}` : n || "";
    }
  }
  $("#req-clear").addEventListener("click", () => { Object.keys(REQ).forEach((k) => { req[k].clear(); ban[k].clear(); }); draw(); });

  // Petites étiquettes ET / OU à côté des titres de rubrique : clic = bascule.
  function modeBtn(store, k, where) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mode-tag";
    const draw1 = () => {
      const and = store[k] === "and";
      b.textContent = and ? "ET" : "OU";
      b.classList.toggle("and", and);
      b.dataset.help = and ? "ET : le jeu doit avoir toutes les étiquettes choisies dans cette rubrique. Clic : passer en OU."
        : "OU : le jeu doit avoir au moins une des étiquettes choisies dans cette rubrique. Clic : passer en ET.";
    };
    b.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation(); // dans un <summary> : ne pas replier la rubrique
      store[k] = store[k] === "and" ? "or" : "and";
      draw1(); hideHelp(); draw();
    });
    b.redraw = draw1;
    draw1();
    where.appendChild(b);
    return b;
  }
  const modeBtns = [];
  for (const k of Object.keys(modeReq)) modeBtns.push(modeBtn(modeReq, k, document.querySelector(`details.req-sec[data-sec="${k}"] > summary h3`)));
  for (const k of Object.keys(modeTag)) {
    const lab = document.querySelector(`.tagfilter[data-key="${k}"] > label`);
    modeBtns.push(modeBtn(modeTag, k, lab));
  }

  // Champs d'étiquettes (famille, auteur, illustrateur, éditeur) : suggestions = étiquettes de mes jeux.
  function drawTagFilters() { panel.tags.drawSuggestions(); panel.tags.drawAllChips(); }
  $("#reset").addEventListener("click", () => {
    NUM_IDS.forEach((id) => { $(`#${id}`).value = ""; });
    $("#f-kw").value = "";
    Object.values(tags).forEach((x) => x.clear());
    Object.values(notTags).forEach((x) => x.clear());
    for (const k of ["av", "b"]) { RATE[k].lo = RATE[k].min; RATE[k].hi = RATE[k].max; panel.rates.draw(k); }
    draw(); // « Garder / exclure » n'est pas touché : bouton « Effacer »
  });

  // Overlay des filtres actifs (survol du mot « Filtres »), comme dans l'explorateur ; ✕ pour en retirer un.
  const fr = (x) => String(x).replace(".", ",");
  function activeFilters() {
    const out = [], F = readF();
    const add = (group, text, clear, cls = "") => out.push({ group, text, clear, cls });
    if (F.kw.length) add("Mots-clés", `« ${$("#f-kw").value.trim()} »`, () => { $("#f-kw").value = ""; });
    for (const k of Object.keys(REQ)) {
      for (const t of req[k]) add("Garder / exclure", `✓ ${D.dict[REQ[k].dict][t]} (${REQ[k].label}${modeReq[k] === "or" && req[k].size > 1 ? ", OU" : ""})`, () => req[k].delete(t));
      for (const t of ban[k]) add("Garder / exclure", `✕ ${D.dict[REQ[k].dict][t]} (${REQ[k].label})`, () => ban[k].delete(t), "ban");
    }
    for (const [k, name] of [["av", "Note BGG"], ["b", "Note bayésienne"]]) {
      if (rateActive(k)) add("Filtres", `${name} : ${fr(RATE[k].lo.toFixed(1))} à ${fr(RATE[k].hi.toFixed(1))}`,
        () => { RATE[k].lo = RATE[k].min; RATE[k].hi = RATE[k].max; panel.rates.draw(k); });
    }
    const span = (lo, hi, unit = "") => (lo !== null && hi !== null ? `${fr(lo)} à ${fr(hi)}${unit}` : lo !== null ? `≥ ${fr(lo)}${unit}` : `≤ ${fr(hi)}${unit}`);
    const clearIds = (...ids) => () => ids.forEach((id) => { $(`#${id}`).value = ""; });
    if (F["pl-min"] !== null || F["pl-max"] !== null) add("Filtres", `Joueurs : ${span(F["pl-min"], F["pl-max"])}`, clearIds("pl-min", "pl-max"));
    if (F["t-min"] !== null || F["t-max"] !== null) add("Filtres", `Durée : ${span(F["t-min"], F["t-max"], " min")}`, clearIds("t-min", "t-max"));
    if (F["age-max"] !== null) add("Filtres", `Âge ≤ ${F["age-max"]} ans`, clearIds("age-max"));
    for (const k of Object.keys(TAG_KEYS)) for (const t of tags[k]) add("Filtres", `${TAG_NAMES[k]} : ${D.dict[TAG_KEYS[k]][t]}${modeTag[k] === "and" && tags[k].size > 1 ? " (ET)" : ""}`, () => tags[k].delete(t));
    for (const k of Object.keys(notTags)) for (const t of notTags[k]) add("Filtres", `✕ ${TAG_NAMES[k]} : ${D.dict[TAG_KEYS[k]][t]}`, () => notTags[k].delete(t), "ban");
    return out;
  }
  const fpop = $("#filter-pop");
  function drawFilterPop() {
    const list = activeFilters();
    const groups = [...new Set(list.map((x) => x.group))];
    fpop.innerHTML = (list.length
      ? groups.map((gname) => `<h4>${gname}</h4><ul>` + list.map((x, j) => (x.group === gname
        ? `<li><span class="${x.cls}">${esc(x.text)}</span><button type="button" data-j="${j}" aria-label="Retirer ce filtre">✕</button></li>` : "")).join("") + "</ul>").join("")
      : "<h4>Aucun filtre actif</h4>") + `<p>${$("#f-stats").textContent}</p>`;
    fpop.querySelectorAll("button[data-j]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      list[+b.dataset.j].clear();
      draw();
      drawFilterPop();
    }));
  }
  {
    const sum = $("#filters-sum");
    let ht2;
    const open = () => {
      clearTimeout(ht2);
      drawFilterPop();
      fpop.hidden = false;
      const r = sum.getBoundingClientRect();
      fpop.style.left = `${Math.min(r.left, window.innerWidth - fpop.offsetWidth - 8)}px`;
      fpop.style.top = `${Math.min(r.bottom + 4, window.innerHeight - fpop.offsetHeight - 8)}px`;
    };
    const close = () => { ht2 = setTimeout(() => { fpop.hidden = true; }, 200); };
    sum.addEventListener("mouseenter", open);
    sum.addEventListener("mouseleave", close);
    fpop.addEventListener("mouseenter", () => clearTimeout(ht2));
    fpop.addEventListener("mouseleave", close);
  }

  // --- Étiquettes du jeu affiché <-> filtres de gauche ---------------------------------------------------------
  // Un clic sur une étiquette du jeu affiché active ou retire le filtre correspondant à gauche (orange des deux
  // côtés) ; un clic sur ce filtre à gauche le retire des deux côtés. (Remplace l'ancienne surbrillance.)
  const HL_NAMES = { m: ["mech", "Méca."], c: ["cat", "Thème"], d: ["des", "Auteur"], pu: ["pub", "Éditeur"], f: ["fam", "Famille"] };
  let saveT = null;
  const queueSave = () => { clearTimeout(saveT); saveT = setTimeout(() => saveUI(), 300); };
  function syncSide() { queueSave(); }


  // Fiche compacte d'un jeu, déplaçable. from = collection d'origine ("" = nouveaux jeux).
  function gcard(id, from, extra = "") {
    const g = byId.get(id);
    if (!g) {
      return `<div class="gcard missing" draggable="true" data-id="${id}" data-from="${from}">` +
        `<span class="gname">Jeu ${id} (absent des données)</span>${rmBtn(from)}</div>`;
    }
    const mech = g.m.map((t) => D.dict.mech[t]).sort().join(", ");
    const help = `${g.n}${g.y ? ` (${g.y})` : ""} · ★ ${g.av.toFixed(2)} · ${players(g.p)} · ${g.t ? `${g.t} min` : "durée ?"}` +
      `${g.a ? ` · ${g.a} ans et +` : ""}. Mécaniques : ${mech || "aucune"}. ${g.ds || ""}`;
    return `<div class="gcard" draggable="true" data-id="${id}" data-from="${from}" data-help="${esc(help)}">` +
      `<span class="gname"><span class="emo">${domEmo(g)}</span> ${esc(g.n)}${g.y ? ` <span class="yr">${g.y}</span>` : ""}</span>` +
      `<span class="gmeta">★ ${g.av.toFixed(1)} · ${players(g.p)} · ${g.t ? `${g.t} min` : "?"}</span>${extra}` +
      `<span class="gact">` +
      `<a href="index.html#${id}" target="bga-explorer" title="Ouvrir dans l'explorateur" draggable="false">↗</a>` +
      `<a href="https://boardgamegeek.com/boardgame/${id}" target="_blank" rel="noopener" title="Fiche BGG" draggable="false">BGG</a>` +
      `${rmBtn(from)}</span></div>`;
  }
  const rmBtn = (from) => `<button type="button" class="grm" data-rm title="${from ? "Retirer de cette collection" : "Retirer de mes jeux (et de toutes les collections)"}">✕</button>`;

  function draw() {
    const games = COLL.list(), colls = COLL.collections();
    const added = new Map(games.map((x) => [x.id, x.added]));
    $("#coll-count").textContent = games.length || "";
    // --- gauche ---
    const all = $("#show-all").checked;
    const F = readF();
    F.active = filterCount(F) > 0;
    $("#filter-count").textContent = filterCount(F) || "";
    const ok = (id) => passes(byId.get(id), F);
    const src = all ? games : COLL.inbox();
    const items = src.map((x) => ({ id: x.id, added: x.added, g: byId.get(x.id) }))
      .filter((x) => ok(x.id))
      .sort(SORTS[$("#inbox-sort").value] || SORTS.added);
    filteredIds = games.filter((x) => ok(x.id)).map((x) => x.id);
    const shown = filteredIds.length;
    $("#f-stats").textContent = F.active ? `${shown} / ${games.length} de tes jeux passent les filtres` : `${games.length} jeu${games.length > 1 ? "x" : ""} au total`;
    // Bouton « Collection avec ces jeux » : seulement avec au moins un filtre actif et un jeu qui passe.
    $("#f-save").hidden = !(F.active && shown);
    $("#f-save-btn").textContent = `＋ Collection avec ces ${shown} jeu${shown > 1 ? "x" : ""}`;
    drawRequired();
    drawTagFilters();
    if (!fpop.hidden) drawFilterPop();
    if (typeof saveUI === "function") queueSave();
    $("#inbox-count").textContent = COLL.inbox().length || "";
    $("#inbox").innerHTML = items.map((x) => {
      const cs = all ? COLL.collectionsOf(x.id).map(ctag).join("") : "";
      return gcard(x.id, "", cs ? `<span class="ctags">${cs}</span>` : "");
    }).join("") || `<p class="hint empty">${games.length
      ? (F.active ? "Aucun nouveau jeu ne passe les filtres." : "Tous tes jeux sont rangés. Ajoute-en depuis l'explorateur.")
      : "Aucun jeu pour l'instant. Dans l'explorateur, clique sur un jeu puis sur « ☆ Ajouter à mes collections » (colonne de droite)."}</p>`;
    // --- droite ---
    $("#colls-count").textContent = colls.length || "";
    $("#colls").innerHTML = colls.map((c) => {
      const ids = [...c.games].filter(ok).sort((a, b) => (byId.get(a)?.n || "").localeCompare(byId.get(b)?.n || ""));
      return `<article class="coll-box dropzone${c.color ? " colored" : ""}" data-drop="${c.cid}"${c.color ? ` style="--cc:${c.color}"` : ""}>
        <div class="coll-head" draggable="true" data-cid="${c.cid}" title="Glisser l'en-tête pour réordonner les collections">
          <span class="cgrip" aria-hidden="true">⠿</span>
          <h3 class="cname" data-cid="${c.cid}" title="Double-clic : renommer ou changer la couleur">${c.color ? '<span class="cdot"></span>' : ""}${esc(c.name)}</h3>
          <span class="badge">${F.active && ids.length !== c.games.length ? `${ids.length} / ${c.games.length}` : c.games.length || ""}</span>
          <button type="button" class="cbtn" data-ren="${c.cid}" title="Renommer, couleur">✎</button>
          <button type="button" class="cbtn" data-del="${c.cid}" title="Supprimer la collection">🗑</button>
        </div>
        <div class="gamelist">${ids.map((id) => gcard(id, c.cid)).join("") || `<p class="hint empty">${c.games.length ? "Aucun jeu ne passe les filtres." : "Glisse des jeux ici."}</p>`}</div>
      </article>`;
    }).join("") || `<p class="hint empty">Aucune collection. Crée-en une ci-dessus (ex. « Coopératifs », « Soirées à 2 »), puis glisse des jeux dedans.</p>`;
    wire();
  }

  // --- Détails du jeu cliqué (panneau de droite) --------------------------------------------------------
  let selected = null; // id BGG du jeu affiché
  const famOfMech = {};
  for (const [k, f] of Object.entries(EMO.families)) for (const m of f.mechanics) famOfMech[m] = k;
  const mechEmo = (name) => (EMO.families[famOfMech[name]] || {}).emoji || "";
  const FAM_SKIP = /^(Admin|Crowdfunding|Digital Implementations|Game|Versions & Editions|Misc):/;
  // Exclusion depuis le détail : mécanique, thème, famille -> « Garder / exclure » (interdite) ;
  // auteur, éditeur -> filtre d'exclusion (pastille « ✕ » sous Auteur / Éditeur). Nouveau clic : retirer.
  // Filtre positif à gauche (indispensable dans « Garder / exclure », ou choisi sous Famille / Auteur / Éditeur) :
  // l'étiquette du jeu affiché est marquée ✓.
  // Une étiquette est soit sélectionnée (✓), soit barrée (✕), jamais les deux : règles dans web/lib/filters.js.
  const isIncluded = (key, t) => isIncludedL(FS, key, t);
  const isExcluded = (key, t) => isExcludedL(FS, key, t);
  // Filtre positif depuis le jeu affiché : méca., thème, famille fine -> « Garder / exclure » (indispensable) ;
  // auteur, éditeur -> champ Auteur / Éditeur. Déjà actif (y compris sous Famille) : retiré partout.
  function toggleInclude(key, t) { includeTag(FS, key, t); draw(); }
  // Exclusion : mécanique, thème, famille -> interdite ; auteur, illustrateur, éditeur -> filtre d'exclusion.
  function toggleExclude(key, t) { excludeTag(FS, key, t); draw(); }
  const tIdx = Object.fromEntries(Object.entries(HL_NAMES).map(([k, [dn]]) => [k, new Map(D.dict[dn].map((x, i) => [x, i]))]));
  function drawDetail() {
    document.querySelectorAll(".gcard").forEach((c) => c.classList.toggle("sel", +c.dataset.id === selected));
    const box = $("#gdetail");
    const g = selected !== null ? byId.get(selected) : null;
    if (!g) {
      box.innerHTML = `<p class="hint">${selected !== null ? `Jeu ${selected} absent des données.` : "Clique sur un jeu pour afficher ses détails ici."}</p>`;
      syncSide();
      return;
    }
    const names = (key, dname, max = Infinity) => {
      const xs = g[key].map((t) => D.dict[dname][t]).filter((x) => key !== "f" || !FAM_SKIP.test(x)).sort((a, b) => a.localeCompare(b));
      // Les étiquettes actives (filtre ✓ ou ✕ à gauche, surbrillance) restent visibles même au-delà de la limite.
      const active = (x) => { const t = tIdx[key].get(x); return isIncluded(key, t) || isExcluded(key, t); };
      const shown = [...xs.slice(0, max), ...xs.slice(max).filter(active)];
      const hidden = xs.length - shown.length;
      return (shown.map((x) => {
        const t = tIdx[key].get(x), ex = isExcluded(key, t), inc = isIncluded(key, t);
        return `<span class="chip toggle hlable${ex ? " ban" : inc ? " on" : ""}" data-hk="${key}" data-ht="${t}" role="button" tabindex="0" ` +
          `data-help="${inc ? "Filtre actif, à gauche aussi (✓). Clic : le retirer des deux côtés." : ex ? "Exclue par les filtres de gauche. Clic : la rendre indispensable." : `Clic : filtrer sur « ${esc(x)} » (filtre activé à gauche aussi).`} Croix : ${ex ? "ne plus exclure" : "exclure les jeux qui l'ont"}.">` +
          `${key === "m" ? `<span class="emo">${mechEmo(x)}</span>` : key === "c" ? `<span class="emo">${EMO.themes[x] || ""}</span>` : ""}${esc(x)}` +
          `<span class="ban-x" data-help="${ex ? "Ne plus exclure." : "Exclure : ne garder que les jeux qui ne l'ont pas."}">✕</span></span>`;
      }).join("")
        || '<span class="hint">aucun</span>') + (hidden > 0 ? `<span class="hint"> +${hidden}</span>` : "");
    };
    const inColl = COLL.collectionsOf(g.id), owned = COLL.has(g.id);
    const exps = (g.x || []).map((t) => D.dict.exp[t]).sort((a, b) => a.localeCompare(b));
    const fmt = (x, u) => (x ? `${x}${u}` : "?");
    box.innerHTML = `
      <h2><span class="emo">${domEmo(g)}</span> ${esc(g.n)}</h2>
      <p class="det-act">
        <a class="tab" href="index.html#${g.id}" target="bga-explorer">Explorer ↗</a>
        <a class="tab" href="https://boardgamegeek.com/boardgame/${g.id}" target="_blank" rel="noopener">Fiche BGG ↗</a>
      </p>
      <dl>
        <dt>Année</dt><dd>${g.y ?? "?"}</dd>
        <dt>Note BGG</dt><dd>${g.av.toFixed(2)} (moyenne) · ${g.b.toFixed(2)} (bayésienne) · ${g.r.toLocaleString("fr-FR")} avis</dd>
        <dt>Joueurs</dt><dd>${g.p[0] && g.p[1] ? (g.p[0] === g.p[1] ? g.p[0] : `${g.p[0]}–${g.p[1]}`) : "?"}</dd>
        <dt>Durée</dt><dd>${fmt(g.t, " min")}</dd>
        <dt>Âge minimal</dt><dd>${fmt(g.a, " ans")}</dd>
        <dt>Collections BGG</dt><dd>${g.ow.toLocaleString("fr-FR")} possèdent · ${g.wi.toLocaleString("fr-FR")} souhaitent · ${g.tr.toLocaleString("fr-FR")} échangent</dd>
      </dl>
      <h3>Mes collections</h3>
      <div class="chips">${owned ? (inColl.map(ctag).join("") || '<span class="hint">pas encore rangé (nouveaux jeux)</span>') : '<span class="hint">retiré de mes jeux</span>'}</div>
      ${g.ds ? `<h3>Description</h3><p class="ds">${esc(g.ds)}</p>` : ""}
      <h3>Mécaniques</h3><div class="chips">${names("m", "mech")}</div>
      <h3>Thème</h3><div class="chips">${names("c", "cat")}</div>
      <h3>Auteurs</h3><div class="chips">${names("d", "des", 8)}</div>
      <h3>Éditeurs</h3><div class="chips">${names("pu", "pub", 6)}</div>
      <h3>Familles</h3><div class="chips">${names("f", "fam", 10)}</div>
      <h3>Extensions BGG (${exps.length})</h3>
      ${exps.length ? `<details class="exp-list"><summary>Afficher la liste</summary><ul>${exps.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : '<span class="hint">aucune</span>'}`;
    box.querySelectorAll(".chip[data-hk]").forEach((ch) => {
      ch.querySelector(".ban-x").addEventListener("click", (e) => {
        e.stopPropagation();
        hideHelp();
        toggleExclude(ch.dataset.hk, +ch.dataset.ht);
      });
      const go = () => { hideHelp(); toggleInclude(ch.dataset.hk, +ch.dataset.ht); };
      ch.addEventListener("click", go);
      ch.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    syncSide();
  }
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".gcard");
    if (!card || e.target.closest("a, button")) return;
    selected = +card.dataset.id;
    hideHelp();
    drawDetail();
  });

  // --- Actions sur les fiches et les collections ------------------------------------------------------
  function wire() {
    drawDetail();
    document.querySelectorAll(".gcard [data-rm]").forEach((b) => b.addEventListener("click", () => {
      const card = b.closest(".gcard"), id = +card.dataset.id, from = card.dataset.from;
      hideHelp();
      if (from) COLL.move(id, from, null); else COLL.remove(id);
    }));
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const c = COLL.collections().find((x) => x.cid === b.dataset.del);
      if (c && (!c.games.length || confirm(`Supprimer la collection « ${c.name} » ? Ses ${c.games.length} jeux restent dans tes jeux.`))) COLL.deleteCollection(c.cid);
    }));
    document.querySelectorAll("[data-ren]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); openCollPop(b.dataset.ren, b); }));
    document.querySelectorAll(".cname").forEach((h) => h.addEventListener("dblclick", () => openCollPop(h.dataset.cid, h)));
  }

  // --- Overlay d'une collection (bouton ✎ ou double-clic sur le nom) : renommer, choisir une couleur ----------
  // La couleur marque le cadre de la collection et ses étiquettes (fiches « Tous mes jeux », détails, explorateur).
  const PALETTE = ["#e8590c", "#f59f00", "#37b24d", "#0ca678", "#1098ad", "#1c7ed6", "#7048e8", "#ae3ec9", "#d6336c", "#868e96"];
  const ctag = (c) => `<span class="ctag${c.color ? " colored" : ""}"${c.color ? ` style="--cc:${c.color}"` : ""}>${esc(c.name)}</span>`;
  const pop = $("#coll-pop");
  let popFor = null;
  function closeCollPop() { pop.hidden = true; popFor = null; }
  function openCollPop(cid, anchor) {
    const c = COLL.collections().find((x) => x.cid === cid);
    if (!c) return;
    hideHelp();
    popFor = cid;
    let color = c.color || "";
    pop.innerHTML = `
      <label for="pop-name">Nom</label>
      <input id="pop-name" maxlength="60" autocomplete="off" value="${esc(c.name)}">
      <label>Couleur</label>
      <div class="swatches">${PALETTE.map((h) => `<button type="button" class="sw" data-c="${h}" style="--cc:${h}" aria-label="Couleur ${h}"></button>`).join("")}` +
      `<button type="button" class="sw none" data-c="" aria-label="Sans couleur" title="Sans couleur">∅</button></div>
      <div class="pop-act"><button type="button" class="secondary" data-a="cancel">Annuler</button><button type="button" data-a="ok">Valider</button></div>`;
    const mark = () => pop.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.c === color));
    mark();
    pop.querySelectorAll(".sw").forEach((b) => b.addEventListener("click", () => { color = b.dataset.c; mark(); }));
    const name = pop.querySelector("#pop-name");
    const ok = () => {
      const v = name.value.trim();
      if (v && v.toLowerCase() !== c.name.toLowerCase() && COLL.collections().some((x) => x.cid !== cid && x.name.toLowerCase() === v.toLowerCase())) {
        flash(`« ${v} » existe déjà.`, true); name.focus(); return;
      }
      closeCollPop();
      COLL.updateCollection(cid, { name: v || c.name, color });
    };
    pop.querySelector('[data-a="ok"]').addEventListener("click", ok);
    pop.querySelector('[data-a="cancel"]').addEventListener("click", closeCollPop);
    name.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8)}px`;
    name.focus(); name.select();
  }
  document.addEventListener("mousedown", (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("[data-ren]")) closeCollPop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { e.stopImmediatePropagation(); closeCollPop(); } }, true);

  // --- Sections Garder / exclure repliables (état mémorisé dans ce navigateur) ---------------------------------
  document.querySelectorAll("details.req-sec").forEach((d) => {
    const key = `bga.reqsec.${d.dataset.sec}`;
    try { if (localStorage.getItem(key) === "0") d.open = false; } catch (_) { /* stockage indisponible */ }
    d.addEventListener("toggle", () => { try { localStorage.setItem(key, d.open ? "1" : "0"); } catch (_) { /* idem */ } });
  });

  // --- Glisser-déposer (délégation sur le document : survit aux redessins) --------------------------------
  let dragging = null;
  // Réordonner les collections : glisser l'en-tête d'un cadre (poignée ⠿) et le déposer avant / après un autre.
  // Position : moitié gauche / droite du cadre visé si la grille a plusieurs colonnes, sinon moitié haute / basse.
  let collDrop = null; // {cid, before}
  const clearCollMarks = () => document.querySelectorAll(".coll-box.drop-before, .coll-box.drop-after").forEach((b) => b.classList.remove("drop-before", "drop-after"));
  function collDropAt(e) {
    const box = e.target.closest && e.target.closest(".coll-box");
    if (!box) return null;
    const r = box.getBoundingClientRect();
    const cols = getComputedStyle($("#colls")).gridTemplateColumns.split(" ").length;
    const before = cols > 1 ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    return { box, cid: box.dataset.drop, before, vert: cols === 1 };
  }
  document.addEventListener("dragstart", (e) => {
    const head = e.target.closest && !e.target.closest(".gcard") && e.target.closest(".coll-head");
    if (head) {
      hideHelp();
      dragging = { coll: head.dataset.cid };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(dragging));
      head.closest(".coll-box").classList.add("dragging");
      document.body.classList.add("is-dragging-coll");
      return;
    }
    const card = e.target.closest && e.target.closest(".gcard");
    if (!card) return;
    hideHelp();
    dragging = { id: +card.dataset.id, from: card.dataset.from };
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", JSON.stringify(dragging));
    card.classList.add("dragging");
    document.body.classList.add("is-dragging");
  });
  document.addEventListener("dragend", (e) => {
    const card = e.target.closest && e.target.closest(".gcard");
    if (card) card.classList.remove("dragging");
    document.querySelectorAll(".dropzone.over").forEach((z) => z.classList.remove("over"));
    document.querySelectorAll(".coll-box.dragging").forEach((b) => b.classList.remove("dragging"));
    clearCollMarks();
    document.body.classList.remove("is-dragging", "is-dragging-coll");
    dragging = null;
    collDrop = null;
  });
  const zoneOf = (e) => e.target.closest && e.target.closest(".dropzone");
  const isCopy = (e) => e.ctrlKey || e.altKey || e.metaKey;
  document.addEventListener("dragover", (e) => {
    if (dragging && dragging.coll) {
      const t = collDropAt(e);
      clearCollMarks();
      if (!t || t.cid === dragging.coll) { collDrop = null; return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      t.box.classList.add(t.before ? "drop-before" : "drop-after");
      t.box.classList.toggle("vert", t.vert);
      collDrop = t;
      return;
    }
    const z = zoneOf(e);
    if (!z || !dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragging.from && z.dataset.drop && isCopy(e) ? "copy" : "move";
    document.querySelectorAll(".dropzone.over").forEach((x) => { if (x !== z) x.classList.remove("over"); });
    z.classList.add("over");
  });
  document.addEventListener("dragleave", (e) => {
    const z = zoneOf(e);
    if (z && !z.contains(e.relatedTarget)) z.classList.remove("over");
  });
  document.addEventListener("drop", (e) => {
    if (dragging && dragging.coll) {
      e.preventDefault();
      const t = collDrop;
      clearCollMarks();
      if (!t) return;
      const ids = COLL.collections().map((c) => c.cid);
      const after = ids[ids.indexOf(t.cid) + 1] || null; // déposer « après » = avant le suivant
      const beforeCid = t.before ? t.cid : after === dragging.coll ? ids[ids.indexOf(t.cid) + 2] || null : after;
      COLL.reorderCollection(dragging.coll, beforeCid);
      return;
    }
    const z = zoneOf(e);
    if (!z) return;
    e.preventDefault();
    z.classList.remove("over");
    let d = dragging;
    try { d = d || JSON.parse(e.dataTransfer.getData("text/plain")); } catch (_) { return; }
    if (!d) return;
    const to = z.dataset.drop || null, from = d.from || null;
    if (to === from) return;
    if (!to) { if (from) COLL.move(d.id, from, null); return; } // vers « Nouveaux jeux » : sortir de la collection
    COLL.move(d.id, from, to, isCopy(e));
    const c = COLL.collections().find((x) => x.cid === to), g = byId.get(d.id);
    flash(`${g ? g.n : `Jeu ${d.id}`} → ${c ? c.name : ""}${from && isCopy(e) ? " (copié)" : ""}`);
  });

  // --- Nouvelle collection à partir des filtres actifs ------------------------------------------------------
  // Tous mes jeux qui passent les filtres (nouveaux jeux et collections confondus) ; ils restent aussi là où ils sont.
  // Nom proposé : les filtres actifs, en abrégé (modifiable).
  let filteredIds = [];
  function filterName() {
    const parts = activeFilters().map((x) => x.text.replace(/ \((Méca\.|Thème|Familles)(, OU)?\)$/, (m0, a, o) => (o ? " (OU)" : "")));
    let name = parts.join(", ");
    if (name.length > 56) name = `${name.slice(0, 55).replace(/[ ,]+[^ ,]*$/, "")}…`;
    return name || "Sélection filtrée";
  }
  $("#f-save-btn").addEventListener("click", () => {
    const f = $("#f-save-form");
    f.hidden = !f.hidden;
    if (!f.hidden) { $("#f-save-name").value = filterName(); $("#f-save-name").focus(); $("#f-save-name").select(); }
  });
  $("#f-save-form").addEventListener("submit", (e) => {
    e.preventDefault();
    let name = $("#f-save-name").value.trim() || filterName();
    const taken = new Set(COLL.collections().map((c) => c.name.toLowerCase()));
    for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${name.replace(/ \(\d+\)$/, "")} (${k})`;
    const ids = filteredIds.slice();
    const cid = COLL.createCollection(name);
    COLL.addMany(ids, cid);
    $("#f-save-form").hidden = true;
    flash(`Collection « ${name} » créée avec ${ids.length} jeu${ids.length > 1 ? "x" : ""}.`);
  });
  $("#f-save-name").addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); $("#f-save-form").hidden = true; } });

  // --- Création, sauvegarde ------------------------------------------------------------------------------
  $("#new-coll").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#new-coll-name").value.trim();
    if (!name) { $("#new-coll-name").focus(); return; }
    if (COLL.collections().some((c) => c.name.toLowerCase() === name.toLowerCase())) { flash(`« ${name} » existe déjà.`, true); return; }
    COLL.createCollection(name);
    $("#new-coll-name").value = "";
  });
  let ft;
  function flash(text, err = false) {
    $("#coll-msg").textContent = text;
    $("#coll-msg").classList.toggle("err", err);
    clearTimeout(ft);
    ft = setTimeout(() => { $("#coll-msg").textContent = ""; }, 4000);
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
    } catch (err) { flash(`Import impossible : ${err.message}`, true); }
    e.target.value = "";
  });
  $("#coll-clear").addEventListener("click", () => {
    const n = COLL.list().length, m = COLL.collections().length;
    if ((n || m) && confirm(`Retirer tes ${n} jeux et tes ${m} collections ?`)) {
      COLL.collections().forEach((c) => COLL.deleteCollection(c.cid));
      COLL.list().forEach((x) => COLL.remove(x.id));
    }
  });
  COLL.onChange(draw); // aussi déclenché par les ajouts faits dans l'explorateur (autre onglet)
  $("#inbox-sort").addEventListener("change", draw);
  $("#show-all").addEventListener("change", draw);

  // --- Aide au survol (attribut data-help, après 400 ms ; masquée pendant un glisser) : web/ui/help-tooltip.js ---

  // --- État de la page mémorisé (jeu affiché, filtres, surbrillance, tri) -----------------------------------
  // Retrouvé en revenant sur l'onglet, même si la page a été rechargée. localStorage de ce navigateur ; illisible
  // ou absent : la page part de l'état vide.
  function saveUI() {
    readF();
    const st = serializeUI(FS, { selected, expanded, showAll: $("#show-all").checked, sort: $("#inbox-sort").value });
    try { localStorage.setItem(UI_KEY, JSON.stringify(st)); } catch (_) { /* stockage indisponible */ }
  }
  function loadUI() {
    let st;
    try { st = JSON.parse(localStorage.getItem(UI_KEY) || "null"); } catch (_) { st = null; }
    const r = deserializeUI(FS, st, { sorts: Object.keys(SORTS), has: (id) => COLL.has(id) });
    if (!r) return;
    for (const k of ["av", "b"]) panel.rates.draw(k);
    NUM_IDS.forEach((id, j) => { $(`#${id}`).value = FS.nums[NUM_STATE[j]] ?? ""; });
    $("#f-kw").value = FS.kwText;
    Object.assign(expanded, r.expanded);
    $("#show-all").checked = r.showAll;
    if (r.sort) $("#inbox-sort").value = r.sort;
    modeBtns.forEach((b) => b.redraw());
    if (r.selected !== null) selected = r.selected; // jeu retiré entre-temps : pas restauré
  }
  loadUI();
  window.addEventListener("pagehide", saveUI);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveUI(); });

  window.name = "bga-collection"; // les liens « Mes collections » de l'explorateur rouvrent cet onglet
  draw();
})();
