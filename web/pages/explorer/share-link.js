/* Lien de partage : bouton « Lien 🔗 » (copie l'adresse de la vue) et application d'un lien reçu (web/lib/share-link.js). */
import { BUDGET, maxDepth, worst } from "../../lib/bfs.js";
import { SEP, decodeView, encodeView } from "../../lib/share-link.js";
import { TAG_KEYS } from "../../lib/dataset.js";
import { $ } from "../../ui/html.js";

export function install(app) {
  const { N, state, sigInt, FS } = app;
  Object.assign(app, { applyShare });
  const pressed = (/** @type {string} */ id, /** @type {boolean} */ on) =>
    $(`#${id}`).setAttribute("aria-pressed", String(on));

  /** Applique un état partagé aux réglages, aux filtres et à l'interface, puis recalcule (applyFilters). */
  function applyShare(/** @type {string} */ share) {
    const r = decodeView(share, FS);
    if (!r) return;
    const { view, metric, ...rest } = r.state;
    Object.assign(state, rest);
    if (state.k && worst(state.k, state.depth) > BUDGET) state.depth = maxDepth(state.k);
    if (r.sigInt) for (const k of Object.keys(r.sigInt)) sigInt[k] = r.sigInt[k];
    if (r.sigFilter !== null) FS.sigFilter = r.sigFilter;
    app.setOpt("noFranchise", "no-franchise", r.options.noFranchise);
    app.setOpt("noReimpl", "no-reimpl", r.options.noReimpl);
    app.setOpt("noExpLine", "no-expline", r.options.noExpLine);
    // --- interface <- état ---
    app.drawKD(null);
    $("#tau").value = Math.round(state.tau * 100);
    $("#tau-out").textContent = `${Math.round(state.tau * 100)} %`;
    pressed("cross", state.cross);
    pressed("show-rating", state.showRating);
    pressed("color-rating", state.colorRating);
    $("#legend-rating").hidden = !state.colorRating;
    pressed("emoji", state.emoji);
    pressed("gems-btn", state.gems);
    $("#gem-row").hidden = !state.gems;
    $("#gem-beta").value = Math.round(state.gemBeta * 100);
    $("#gem-beta-out").textContent = state.gemBeta.toFixed(1).replace(".", ",");
    $("#signals").checked = state.signals;
    $("#legend-signals").hidden = !state.signals;
    $("#sig-row").hidden = !state.signals;
    $("#sig-filter").checked = FS.sigFilter;
    app.drawSig();
    app.drawWeights();
    app.panel.writeInputs();
    for (const k of ["av", "b"]) app.panel.rates.draw(k);
    for (const k of Object.keys(TAG_KEYS)) app.panel.tags.drawChips(k);
    app.drawRequired();
    if (metric) app.setMetric(metric);
    app.applyFilters();
    if (view && view !== state.view) app.setView(view);
  }

  const btn = $("#share-btn");
  btn.addEventListener("click", async () => {
    const id = N[state.center]?.id;
    if (id === undefined) return;
    app.readFilters(); // saisie en cours (anti-rebond) incluse
    const url = `${location.origin}${location.pathname}#${id}${SEP}${encodeView({ state, sigInt, F: FS })}`;
    let ok = true;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      ok = false;
      history.replaceState(null, "", url); // à défaut du presse-papiers : l'adresse du navigateur contient le lien
    }
    app.hideHelp();
    $("#search-msg").classList.remove("err");
    $("#search-msg").textContent = ok ? "Lien copié dans le presse-papiers." : "Lien placé dans la barre d'adresse.";
    setTimeout(() => {
      if ($("#search-msg").textContent.startsWith("Lien")) $("#search-msg").textContent = "";
    }, 3000);
  });
}
