/* Panneau de détails du jeu cliqué (colonne de droite). */
import { TAG_KEYS } from "../../lib/dataset.js";
import { METRICS } from "../../lib/metrics.js";
import { $, escapeHtml } from "../../ui/html.js";

export function install(app) {
  const { D, hideHelp, N, emoTag, BEH, markWish, markTrade, state, FS, neighbors, label } = app;
  Object.assign(app, { select }); // fonctions : disponibles dès le début (hissées)
  // --- Panneau de détails -------------------------------------------------------------------
  function select(i) {
    state.selected = i;
    app.gNodes.selectAll("g.node").classed("selected", (n) => n.i === i);
    const g = N[i];
    const c = N[state.center];
    const isCenter = i === state.center;
    const p = app.current.parent.get(i);

    // Étiquettes du jeu cliqué : un clic active / retire le filtre correspondant à gauche (orange des deux côtés).
    //   mécaniques, catégories -> « Garder / exclure » (indispensable) ; auteurs, illustrateurs, éditeurs, familles ->
    //   champs Auteur / Illustrateur / Éditeur / Famille. Étiquette filtrée : pleine avec ✓ ; interdite : rouge barrée ;
    //   sinon, commune avec le jeu central : orange et marron (« shared »).
    const fChip = (key, t, name, shared, kind) => {
      const on = kind === "req" ? FS.req[key].has(t) : FS.tags[key].has(t);
      const ban = kind === "req" ? FS.ban[key].has(t) : key === "f" && FS.ban.f.has(t);
      const cls = on ? " f-on" : ban ? " f-ban" : shared ? " shared" : "";
      const help = on
        ? "Filtre actif (à gauche aussi). Clic : le retirer des deux côtés."
        : ban
          ? "Interdite dans « Garder / exclure ». Clic : la rendre indispensable."
          : "Clic : filtrer sur cette étiquette (seuls les jeux qui l'ont seront proposés).";
      return (
        `<span class="chip fchip${cls}" data-fk="${key}" data-ft="${t}" data-kind="${kind}" role="button" tabindex="0" data-help="${help}">` +
        `${kind === "req" ? emoTag(key, t) : ""}${escapeHtml(name)}</span>`
      );
    };
    const sharedChips = (key, dname) => {
      const ref = new Set(c[key]);
      return (
        g[key]
          .map((t) => [t, D.dict[dname][t]])
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([t, name]) => fChip(key, t, name, !isCenter && ref.has(t), "req"))
          .join("") || `<span class="hint">aucune</span>`
      );
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
      ? `s = ${p[1].toFixed(3)} (${METRICS[state.metric].label}) · ${escapeHtml(app.breakdown(p[0], i))}`
      : "";
    const nb =
      neighbors(i)
        .slice(0, Math.min(state.k, 50))
        .map(
          ([j, s, g2]) =>
            `<li data-i="${j}"${s < state.tau ? ' class="below"' : ""} data-help="` +
            escapeHtml(
              `Clic : recentrer sur ce jeu. Similarité s = ${s.toFixed(3)}` +
                (s < state.tau ? " (sous le seuil τ, absent du graphe)" : "") +
                (g2 !== undefined
                  ? ` · pépite : s·q^β = ${g2.toFixed(3)}, note ${N[j].av.toFixed(1)}, ${N[j].r} avis`
                  : ""),
            ) +
            `">` +
            `<span>${escapeHtml(label(j))}</span><span class="score">${s.toFixed(3)}</span></li>`,
        )
        .join("") || `<li class="hint">aucun voisin avec ces filtres</li>`;

    // Extensions officielles BGG (noms seulement : elles ne sont pas dans les données) et jeux de la même gamme.
    const line = g.xl >= 0 ? N.map((_, j) => j).filter((j) => j !== i && N[j].xl === g.xl) : [];
    const exNames = g.x.map((t) => D.dict.exp[t]).sort((a, b) => a.localeCompare(b));
    const expBlock =
      `<h3 data-help="Extensions officielles listées par BGG (extensions de fans exclues). Les extensions ne sont pas des jeux de l'interface : noms seulement.">Extensions BGG (${exNames.length})</h3>` +
      (exNames.length
        ? `<details class="exp-list"><summary>${exNames.length > 1 ? "Afficher la liste" : escapeHtml(exNames[0])}</summary>` +
          `<ul>${exNames.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul></details>`
        : `<span class="hint">aucune</span>`) +
      (line.length
        ? `<h3 data-help="Jeux qui partagent une extension avec celui-ci (même gamme compatible). « Sans extension » les écarte. Clic : recentrer.">Même gamme</h3>` +
          `<ol class="nb-list">${line.map((j) => `<li data-i="${j}"><span>${escapeHtml(label(j))}</span></li>`).join("")}</ol>`
        : "");
    const d = $("#details");
    d.hidden = false;
    d.innerHTML = `
      <h2>${escapeHtml(g.n)}</h2>
      ${app.collBtn(g)}
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
      ${isCenter && !app.pass[i] ? `<p class="kv">Ce jeu ne passe pas les filtres (affiché car choisi).</p>` : ""}
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
    d.querySelectorAll(".nb-list li[data-i]").forEach((li) =>
      li.addEventListener("click", () => app.setCenter(+li.dataset.i)),
    );
    d.querySelectorAll(".chip.fchip").forEach((ch) => {
      const toggle = () => {
        const k = ch.dataset.fk,
          t = +ch.dataset.ft;
        hideHelp();
        if (ch.dataset.kind === "req") {
          if (!FS.req[k].delete(t)) {
            FS.ban[k].delete(t);
            FS.req[k].add(t);
          }
          app.drawRequired();
        } else {
          if (!FS.tags[k].delete(t)) {
            if (k === "f") FS.ban.f.delete(t);
            FS.tags[k].add(t);
          }
          app.drawRequired();
          app.panel.tags.drawChips(k);
        }
        app.applyFilters(); // redessine le graphe et ce panneau
      };
      ch.addEventListener("click", toggle);
      ch.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
    const rc = d.querySelector("#recenter");
    if (rc) rc.addEventListener("click", () => app.setCenter(i));
    const cb = d.querySelector("#coll-btn");
    if (cb)
      cb.addEventListener("click", () => {
        app.COLL.toggle(g.id);
      });
  }
}
