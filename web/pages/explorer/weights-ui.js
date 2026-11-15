/* Pondération des attributs (quatre curseurs normalisés), τ, réinitialisation, légende. */
import { TAG_KEYS } from "../../lib/dataset.js";
import { $ } from "../../ui/html.js";

export function install(app) {
  const { D, hideHelp, N, depthColor, ATTRS, ATTR_KEYS, state, FS, attrWeights } = app;
  Object.assign(app, { drawWeights }); // fonctions : disponibles dès le début (hissées)
  // --- Pondération des attributs : quatre curseurs normalisés -------------------------------------------
  //   v_k ∈ [0, 100] par attribut, w_k = v_k / Σ v. La ligne des pourcentages (w_k) reste toujours visible ;
  //   la case « Curseurs » affiche les curseurs. Clic sur un pourcentage : cet attribut seul.
  const pct = (x) => `${Math.round(x * 100)} %`;
  function drawWeights() {
    const w = attrWeights();
    for (const k of ATTR_KEYS) $(`#w-${k}`).value = state.wRaw[k];
    $("#weights").innerHTML = ATTR_KEYS.map(
      (k) =>
        `<span class="wchip${w[k] > 0 ? "" : " zero"}" data-k="${k}" role="button" tabindex="0" ` +
        `data-help="Poids de « ${ATTRS[k].label} » dans la ressemblance totale. Clic : ne garder que cet attribut.">` +
        `${ATTRS[k].label} <b>${pct(w[k])}</b></span>`,
    ).join("");
    $("#weights")
      .querySelectorAll(".wchip")
      .forEach((el) => {
        const solo = () => {
          hideHelp();
          app.soloAttr(el.dataset.k);
        };
        el.addEventListener("click", solo);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            solo();
          }
        });
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
      tm = setTimeout(() => app.invalidate(), 120);
    });
  }
  $("#show-sliders").addEventListener("change", (e) => {
    $("#wsliders").hidden = !e.target.checked;
  });
  drawWeights();

  // τ : seuil appliqué après le top-k, sans recalcul des voisins.
  $("#tau").addEventListener("input", (e) => {
    state.tau = e.target.value / 100;
    $("#tau-out").textContent = `${Math.round(state.tau * 100)} %`;
    if (state.center >= 0) app.render();
  });

  $("#reset").addEventListener("click", () => {
    for (const id of ["f-kw", "pl-min", "pl-max", "t-min", "t-max", "age-max", "w-min", "w-max"])
      $(`#${id}`).value = "";
    for (const k of Object.keys(TAG_KEYS)) {
      FS.tags[k].clear();
      app.panel.tags.drawChips(k);
    }
    app.setOpt("noFranchise", "no-franchise", false);
    app.setOpt("noReimpl", "no-reimpl", false);
    app.setOpt("noExpLine", "no-expline", false);
    $("#sig-filter").checked = FS.sigFilter = false;
    for (const k of ["av", "b"]) {
      FS.rate[k].lo = FS.rate[k].min;
      FS.rate[k].hi = FS.rate[k].max;
      app.panel.rates.draw(k);
    }
    // « Garder / exclure » n'est pas touché : il a son propre bouton « Effacer ».
    app.applyFilters();
  });
  $("#req-clear").addEventListener("click", () => {
    app.clearReqBan();
    app.drawRequired();
    app.applyFilters();
  });

  app.svg.on("click", () => {
    if (!app.pick && state.center >= 0) app.select(state.center);
  });
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => state.center >= 0 && app.render(), 200);
  });

  // Légende et méta-données
  $("#legend-depth").innerHTML = [0, 1, 2, 3, 4]
    .map(
      (d) =>
        `<li><span class="dot" style="background:${depthColor(d)}"></span>${d === 0 ? "jeu choisi" : `niveau ${d}`}</li>`,
    )
    .join("");
  $("#meta").textContent =
    `${N.length} jeux (≥ ${D.meta.min_ratings} avis) · cosinus IDF lissé (étiquettes de moins de ` +
    `${D.meta.min_support} jeux ignorées) · source : ${D.meta.source} · généré le ${D.meta.generated}. ` +
    `Données BoardGameGeek, usage non commercial.`;
}
