/* Panneau Filtres de l'explorateur : application des filtres, jeux qui passent, pastilles « Garder / exclure ». */
import { createKeywordText } from "../../lib/keywords.js";
import {
  clearReqBan as clearReqBanL,
  computePass,
  filterCount,
  rateActive as rateActiveL,
  reqBanCount,
} from "../../lib/filters.js";
import { $, escapeHtml } from "../../ui/html.js";
import { createFilterPanel } from "../../ui/filter-panel/filter-panel.js";

export function install(app) {
  const { D, hideHelp, N, ds, ATTRS, ATTR_KEYS, emoTag, sigActive, inInt, state, FS, nbIndex } = app;
  Object.assign(app, { applyFilters, drawRequired, invalidate }); // fonctions : disponibles dès le début (hissées)
  const panel = createFilterPanel($("#filter-panel"), {
    mode: "explorer",
    D,
    F: FS,
    hideHelp,
    debounce: 250,
    onChange: () => applyFilters(),
    suggestions: (key) => ds.tagOrder[key].map((t) => [t, ds.tagFreq[key][t]]),
  });
  // --- Filtres -------------------------------------------------------------------------------
  // Recherche par mots-clés, notes, signaux, étiquettes : voir web/lib/filters.js (état FS, prédicat unique).
  const kwText = createKeywordText(D);
  const readFilters = () => panel.readInputs();
  const rateActive = (k) => rateActiveL(FS, k);
  const passCtx = () => ({
    kwText: (g) => kwText(g),
    terms: (g, i, key) => ATTRS[key].set[i],
    signals: state.signals ? { active: sigActive, inInt } : null,
  });
  function applyFilters() {
    const F = readFilters();
    app.pass = computePass(N, F, passCtx());
    $("#filter-count").textContent =
      filterCount(F, { sigOn: state.signals, sigActive: sigActive("wish") || sigActive("trade") }) || "";
    $("#req-count").textContent = reqBanCount(F) || "";
    if (!$("#filter-pop").hidden) app.drawFilterPop();
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
      box.innerHTML =
        items
          .map(([t, name]) => {
            const st = FS.req[key].has(t) ? "on" : FS.ban[key].has(t) ? "ban" : "";
            const extra = st && !own.has(t);
            const help =
              st === "on"
                ? "Indispensable : chaque voisin doit l'avoir. Clic : revenir à neutre ; croix : l'interdire."
                : st === "ban"
                  ? "Interdite : aucun voisin ne doit l'avoir. Clic ou croix : revenir à neutre."
                  : "Neutre. Clic : la rendre indispensable ; croix à droite : l'interdire.";
            const xHelp = st === "ban" ? "Retirer l'interdiction." : "Interdire : aucun voisin ne doit l'avoir.";
            return (
              `<span class="chip toggle${st ? ` ${st}` : ""}${extra ? " extra" : ""}" data-t="${t}" role="button" ` +
              `tabindex="0" data-help="${escapeHtml(help + (extra ? " (absente du jeu central)" : ""))}">${emoTag(key, t)}${escapeHtml(name)}` +
              `<span class="ban-x" aria-label="Interdire" data-help="${escapeHtml(xHelp)}">✕</span></span>`
            );
          })
          .join("") || `<span class="hint">aucune</span>`;
      box.querySelectorAll(".chip").forEach((ch) => {
        const t = +ch.dataset.t;
        const done = () => {
          hideHelp();
          drawRequired();
          applyFilters();
        };
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
            if (key === "f" && FS.tags.f.delete(t)) panel.tags.drawChips("f"); // la même famille ne reste pas choisie sous Famille
            FS.ban[key].add(t);
          }
          done();
        };
        ch.addEventListener("click", (e) =>
          /** @type {Element} */ (e.target).closest(".ban-x") ? toggleBan() : toggleReq(),
        );
        ch.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleReq();
          } else if (e.key === "Delete" || e.key === "Backspace" || e.key === "x") {
            e.preventDefault();
            toggleBan();
          }
        });
      });
    }
  }
  function invalidate() {
    nbIndex.invalidate();
    if (state.center >= 0) app.render();
  }

  Object.assign(app, { panel, readFilters, rateActive, clearReqBan });
}
