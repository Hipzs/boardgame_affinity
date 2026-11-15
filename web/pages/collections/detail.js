/* Détails du jeu cliqué (colonne de droite) et étiquettes synchronisées avec les filtres de gauche. */
import { excludeTag, includeTag, isExcluded as isExcludedL, isIncluded as isIncludedL } from "../../lib/filters.js";
import { $, escapeHtml as esc } from "../../ui/html.js";

export function install(app) {
  const { hideHelp, D, byId, domEmo, FS, COLL, EMO } = app;
  Object.assign(app, { drawDetail }); // fonctions : disponibles dès le début (hissées)
  // --- Détails du jeu cliqué (panneau de droite) --------------------------------------------------------
  app.selected = null; // id BGG du jeu affiché
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
  function toggleInclude(key, t) {
    includeTag(FS, key, t);
    app.draw();
  }
  // Exclusion : mécanique, thème, famille -> interdite ; auteur, illustrateur, éditeur -> filtre d'exclusion.
  function toggleExclude(key, t) {
    excludeTag(FS, key, t);
    app.draw();
  }
  const tIdx = Object.fromEntries(
    Object.entries(app.HL_NAMES).map(([k, [dn]]) => [k, new Map(D.dict[dn].map((x, i) => [x, i]))]),
  );
  function drawDetail() {
    document
      .querySelectorAll(".gcard")
      .forEach((c) => c.classList.toggle("sel", Number(/** @type {HTMLElement} */ (c).dataset.id) === app.selected));
    const box = $("#gdetail");
    const g = app.selected !== null ? byId.get(app.selected) : null;
    if (!g) {
      box.innerHTML = `<p class="hint">${app.selected !== null ? `Jeu ${app.selected} absent des données.` : "Clique sur un jeu pour afficher ses détails ici."}</p>`;
      app.syncSide();
      return;
    }
    const names = (key, dname, max = Infinity) => {
      const xs = g[key]
        .map((t) => D.dict[dname][t])
        .filter((x) => key !== "f" || !FAM_SKIP.test(x))
        .sort((a, b) => a.localeCompare(b));
      // Les étiquettes actives (filtre ✓ ou ✕ à gauche, surbrillance) restent visibles même au-delà de la limite.
      const active = (x) => {
        const t = tIdx[key].get(x);
        return isIncluded(key, t) || isExcluded(key, t);
      };
      const shown = [...xs.slice(0, max), ...xs.slice(max).filter(active)];
      const hidden = xs.length - shown.length;
      return (
        (shown
          .map((x) => {
            const t = tIdx[key].get(x),
              ex = isExcluded(key, t),
              inc = isIncluded(key, t);
            return (
              `<span class="chip toggle hlable${ex ? " ban" : inc ? " on" : ""}" data-hk="${key}" data-ht="${t}" role="button" tabindex="0" ` +
              `data-help="${inc ? "Filtre actif, à gauche aussi (✓). Clic : le retirer des deux côtés." : ex ? "Exclue par les filtres de gauche. Clic : la rendre indispensable." : `Clic : filtrer sur « ${esc(x)} » (filtre activé à gauche aussi).`} Croix : ${ex ? "ne plus exclure" : "exclure les jeux qui l'ont"}.">` +
              `${key === "m" ? `<span class="emo">${mechEmo(x)}</span>` : key === "c" ? `<span class="emo">${EMO.themes[x] || ""}</span>` : ""}${esc(x)}` +
              `<span class="ban-x" data-help="${ex ? "Ne plus exclure." : "Exclure : ne garder que les jeux qui ne l'ont pas."}">✕</span></span>`
            );
          })
          .join("") || '<span class="hint">aucun</span>') + (hidden > 0 ? `<span class="hint"> +${hidden}</span>` : "")
      );
    };
    const inColl = COLL.collectionsOf(g.id),
      owned = COLL.has(g.id);
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
      <div class="chips">${owned ? inColl.map(app.ctag).join("") || '<span class="hint">pas encore rangé (nouveaux jeux)</span>' : '<span class="hint">retiré de mes jeux</span>'}</div>
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
      const go = () => {
        hideHelp();
        toggleInclude(ch.dataset.hk, +ch.dataset.ht);
      };
      ch.addEventListener("click", go);
      ch.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    });
    app.syncSide();
  }
  document.addEventListener("click", (e) => {
    const card = /** @type {Element} */ (e.target).closest(".gcard");
    if (!card || /** @type {Element} */ (e.target).closest("a, button")) return;
    app.selected = Number(/** @type {HTMLElement} */ (card).dataset.id);
    hideHelp();
    drawDetail();
  });

  Object.assign(app, { mechEmo });
}
