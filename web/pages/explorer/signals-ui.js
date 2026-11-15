/* Signaux (convoitise, revente) : intervalles de centiles, préréglages, marquage. */
import { createBandDrag } from "../../ui/dual-range.js";
import { $ } from "../../ui/html.js";

export function install(app) {
  const { hideHelp, N, sigInt, sigActive, inInt, state, FS } = app;
  const SIG_PRESETS = {
    keep: { wish: [80, 100], trade: [0, 30] },
    flip: { wish: [80, 100], trade: [70, 100] },
    cold: { wish: [0, 20], trade: [0, 100] },
    all: { wish: [0, 100], trade: [0, 100] },
  };
  function drawSig() {
    const fmt = (k) => (sigActive(k) ? `c${sigInt[k][0]} → c${sigInt[k][1]}` : "tous");
    for (const k of ["wish", "trade"]) {
      const [lo, hi] = sigInt[k];
      $(`#${k}-lo`).value = lo;
      $(`#${k}-hi`).value = hi;
      // Poignées superposées : à droite, la poignée basse passe dessus (sinon bloquée sous la haute en 100/100).
      $(`#${k}-lo`).style.zIndex = lo > 50 ? 3 : 1;
      $(`#${k}-out`).textContent = fmt(k);
      const box = $(`#${k}-int`);
      box.style.setProperty("--lo", `${lo}%`);
      box.style.setProperty("--hi", `${hi}%`);
      box.classList.toggle("inactive", !sigActive(k));
    }
    const n = (f) => N.reduce((a, _, i) => a + (f(i) ? 1 : 0), 0);
    const both = n((i) => ["wish", "trade"].every((k) => !sigActive(k) || inInt(k, i)));
    $("#sig-count").textContent =
      sigActive("wish") || sigActive("trade")
        ? `${both} jeux dans les intervalles actifs`
        : "aucun intervalle actif : glisse une poignée";
    document.querySelectorAll(".sig-preset").forEach((b) => {
      const P = SIG_PRESETS[/** @type {HTMLElement} */ (b).dataset.p];
      b.classList.toggle(
        "on",
        ["wish", "trade"].every((k) => P[k][0] === sigInt[k][0] && P[k][1] === sigInt[k][1]),
      );
    });
  }
  let sgt;
  const sigChanged = () => {
    drawSig();
    clearTimeout(sgt);
    sgt = setTimeout(() => {
      if (FS.sigFilter) app.applyFilters();
      else if (state.center >= 0) app.render();
    }, 120);
  };
  for (const k of ["wish", "trade"]) {
    $(`#${k}-lo`).addEventListener("input", (e) => {
      sigInt[k][0] = Math.min(+e.target.value, sigInt[k][1]);
      sigChanged();
    });
    $(`#${k}-hi`).addEventListener("input", (e) => {
      sigInt[k][1] = Math.max(+e.target.value, sigInt[k][0]);
      sigChanged();
    });
  }
  document.querySelectorAll(".sig-preset").forEach((b) =>
    b.addEventListener("click", () => {
      const P = SIG_PRESETS[/** @type {HTMLElement} */ (b).dataset.p];
      for (const k of ["wish", "trade"]) sigInt[k] = [...P[k]];
      hideHelp();
      sigChanged();
    }),
  );
  $("#sig-filter").addEventListener("change", (e) => {
    FS.sigFilter = e.target.checked;
    app.applyFilters();
  });
  drawSig();

  for (const k of ["wish", "trade"]) {
    createBandDrag($(`#${k}-int`), {
      onStart: hideHelp,
      min: 0,
      max: 100,
      step: 1,
      get: () => /** @type {[number, number]} */ ([...sigInt[k]]),
      set: (lo, hi) => {
        sigInt[k] = [lo, hi];
        sigChanged();
      },
    });
  }
  document
    .querySelectorAll(".view-btn[data-view]")
    .forEach((b) => b.addEventListener("click", () => app.setView(/** @type {HTMLElement} */ (b).dataset.view)));
  $("#fam-center").addEventListener("click", () => {
    state.famCenter = state.famCenter === "peak" ? "mean" : "peak";
    hideHelp();
    if (state.center >= 0) app.render();
  });
  $("#fam-btn").addEventListener("click", () => {
    state.famView = !state.famView;
    if (!state.famView) state.famOpen = null;
    hideHelp();
    if (state.center >= 0) app.render();
  });
  app.msvg.on("click", () => {
    if (state.center >= 0) app.select(state.center);
  });
  $("#gems-btn").addEventListener("click", () => {
    state.gems = !state.gems;
    $("#gems-btn").setAttribute("aria-pressed", state.gems);
    $("#gem-row").hidden = !state.gems;
    app.invalidate();
  });
  let gt;
  $("#gem-beta").addEventListener("input", (e) => {
    $("#gem-beta-out").textContent = (e.target.value / 100).toFixed(1).replace(".", ",");
    clearTimeout(gt);
    gt = setTimeout(() => {
      state.gemBeta = e.target.value / 100;
      if (state.gems) app.invalidate();
    }, 120);
  });
  // Boutons d'affichage posés en haut à gauche du graphe : note écrite dans les bulles, couleur = note.
  $("#show-rating").addEventListener("click", (e) => {
    state.showRating = !state.showRating;
    e.currentTarget.setAttribute("aria-pressed", state.showRating);
    if (state.center >= 0) app.render();
  });
  $("#color-rating").addEventListener("click", (e) => {
    state.colorRating = !state.colorRating;
    e.currentTarget.setAttribute("aria-pressed", state.colorRating);
    $("#legend-rating").hidden = !state.colorRating;
    if (state.center >= 0) app.render();
  });
  $("#legend-rating .gradient").style.background = `linear-gradient(to right, ${d3
    .range(0, 1.01, 0.1)
    .map((t) => d3.interpolateViridis(t))
    .join(", ")})`;
}
