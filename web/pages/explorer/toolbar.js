/* Barre de contrôles : recentrage, recherche du jeu, voisins ↔ profondeur (budget), options, découverte. */
import { BUDGET, KS, maxDepth, maxK, worst } from "../../lib/bfs.js";
import { $, escapeHtml } from "../../ui/html.js";

export function install(app) {
  const { D, N, EMO, state, label, resolve, byLabel } = app;
  Object.assign(app, { setCenter, setOpt, drawKD }); // fonctions : disponibles dès le début (hissées)
  // --- Contrôles ------------------------------------------------------------------------------
  function setCenter(i) {
    if (app.pick) app.endPick();
    state.center = i;
    state.selected = i;
    $("#search").value = label(i);
    $("#search-msg").textContent = "";
    $("#search-msg").classList.remove("err");
    try {
      history.replaceState(null, "", `#${N[i].id}`);
    } catch {
      /* file:// selon le navigateur */
    }
    app.drawRequired();
    app.render(); // le zoom courant est conservé : app.render() replace le nouveau centre au milieu sans saut
    if (state.view === "map") app.focusMap();
  }
  function go() {
    const i = resolve($("#search").value);
    if (i < 0) {
      $("#search-msg").textContent =
        `Aucun jeu trouvé (seuls les ${N.length} jeux ayant au moins ${D.meta.min_ratings} avis sont inclus).`;
      $("#search-msg").classList.add("err");
      return;
    }
    setCenter(i);
  }
  $("#go").addEventListener("click", go);
  $("#search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });
  $("#search").addEventListener("change", () => {
    if (byLabel.has($("#search").value.trim().toLowerCase())) go();
  });

  // --- Voisins ↔ profondeur : budget W(k, d) = k + k² + … + k^d ≤ 300 (pire cas : chaque niveau entièrement nouveau) ---
  // Les deux curseurs sont indépendants tant que le budget tient ; au-delà, celui qu'on bouge pousse l'autre
  // (« butée ») : monter k fait descendre la profondeur, monter la profondeur fait descendre k.
  function drawKD(pushed) {
    $("#k").value = KS.indexOf(state.k);
    $("#depth").value = state.depth;
    $("#k-out").textContent = state.k;
    $("#depth-out").textContent = state.depth;
    // Aide au survol de la ligne : budget détaillé pour les réglages courants.
    $("#kd-msg").dataset.help =
      `Jeux affichés autour du jeu choisi / maximum possible avec ces réglages : au pire ` +
      `k + k² + … + k^profondeur = ${worst(state.k, state.depth)} jeux (chaque niveau entièrement nouveau), limité à ${BUDGET}. ` +
      `À profondeur ${state.depth} : voisins ≤ ${maxK(state.depth)} ; à ${state.k} voisins : profondeur ≤ ${maxDepth(state.k)}. ` +
      `Monter un curseur au-delà du budget fait descendre l'autre ; en pratique les voisins se recoupent, d'où moins de jeux. ` +
      `Les voisins sont cherchés parmi les seuls jeux qui passent les filtres.`;
    for (const id of ["k", "depth"]) {
      const out = $(`#${id}-out`);
      out.classList.remove("pushed");
      if (id === pushed) {
        void out.offsetWidth;
        out.classList.add("pushed");
      } // relance l'animation
    }
  }
  $("#k").addEventListener("input", (e) => {
    state.k = KS[+e.target.value];
    let pushed = null;
    if (worst(state.k, state.depth) > BUDGET) {
      state.depth = maxDepth(state.k);
      pushed = "depth";
    }
    drawKD(pushed);
    if (state.center >= 0) app.render();
  });
  $("#depth").addEventListener("input", (e) => {
    state.depth = +e.target.value;
    let pushed = null;
    if (worst(state.k, state.depth) > BUDGET) {
      state.k = maxK(state.depth);
      pushed = "k";
    }
    drawKD(pushed);
    if (state.center >= 0) app.render();
  });
  drawKD(null);
  $("#cross").addEventListener("click", (e) => {
    state.cross = !state.cross;
    e.currentTarget.setAttribute("aria-pressed", state.cross);
    if (state.center >= 0) app.render();
  });
  // Panneau « Options » (haut de la colonne droite) : boutons bascule. setOpt(clé d'état, id du bouton, valeur).
  function setOpt(key, id, on) {
    state[key] = on;
    $(`#${id}`).setAttribute("aria-pressed", on);
  }
  for (const [key, id] of [
    ["noReimpl", "no-reimpl"],
    ["noFranchise", "no-franchise"],
    ["noExpLine", "no-expline"],
  ]) {
    $(`#${id}`).addEventListener("click", () => {
      setOpt(key, id, !state[key]);
      app.applyFilters();
    });
  }
  $("#emoji").addEventListener("click", () => {
    setOpt("emoji", "emoji", !state.emoji);
    if (state.center >= 0) app.render();
  });

  // Légende des émojis (repliable) : familles de mécaniques puis thèmes.
  {
    const fams = Object.values(EMO.families)
      .map(
        (f) =>
          `<li data-help="${escapeHtml(f.label + " : " + f.mechanics.join(", "))}"><span class="emo">${f.emoji}</span>${escapeHtml(f.label)}</li>`,
      )
      .join("");
    const byEmoji = new Map();
    for (const [name, e] of Object.entries(EMO.themes)) byEmoji.set(e, [...(byEmoji.get(e) || []), name]);
    const themes = [...byEmoji]
      .map(
        ([e, names]) =>
          `<li data-help="${escapeHtml(names.join(", "))}"><span class="emo">${e}</span>${escapeHtml(names.length > 1 ? names[0] + " (+" + (names.length - 1) + ")" : names[0])}</li>`,
      )
      .join("");
    $("#emoji-legend").innerHTML =
      `<h3>Familles de mécaniques</h3><ul class="emo-grid">${fams}</ul>` +
      `<h3>Thèmes</h3><ul class="emo-grid">${themes}</ul>`;
  }
  $("#signals").addEventListener("change", (e) => {
    state.signals = e.target.checked;
    $("#legend-signals").hidden = !state.signals;
    $("#sig-row").hidden = !state.signals;
    app.applyFilters(); // le filtre par signaux ne s'applique que si les signaux sont affichés
  });
  // Un curseur à deux poignées par signal : intervalle [bas, haut] de centiles. Raccourcis pour les cas courants.
}
