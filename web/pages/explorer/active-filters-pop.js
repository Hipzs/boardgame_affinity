/* Overlay des filtres actifs (survol du mot « Filtres »). */
import { TAG_KEYS } from "../../lib/dataset.js";
import { $, escapeHtml, fr } from "../../ui/html.js";

export function install(app) {
  const { D, N, ATTRS, ATTR_KEYS, sigInt, sigActive, state, FS } = app;
  Object.assign(app, { drawFilterPop }); // fonctions : disponibles dès le début (hissées)
  // --- Overlay des filtres actifs (survol du mot « Filtres ») ------------------------------------------
  // Liste chaque filtre en place (y compris « Garder / exclure »), avec ✕ pour le retirer.
  function activeFilters() {
    const out = [];
    const add = (group, text, clear, cls = "") => out.push({ group, text, clear, cls });
    const TAG_NAMES = { f: "Famille", d: "Auteur", ar: "Illustrateur", pu: "Éditeur" };
    for (const key of Object.keys(TAG_KEYS))
      for (const t of FS.tags[key]) {
        add("Filtres", `${TAG_NAMES[key]} : ${D.dict[TAG_KEYS[key]][t]}`, () => {
          FS.tags[key].delete(t);
          app.panel.tags.drawChips(key);
        });
      }
    const F = app.readFilters();
    if (F.kw.length)
      add("Filtres", `Mots-clés : « ${$("#f-kw").value.trim()} »`, () => {
        $("#f-kw").value = "";
      });
    const span = (lo, hi, unit = "") =>
      lo !== null && hi !== null
        ? `${fr(lo)} à ${fr(hi)}${unit}`
        : lo !== null
          ? `≥ ${fr(lo)}${unit}`
          : `≤ ${fr(hi)}${unit}`;
    const clearIds =
      (...ids) =>
      () =>
        ids.forEach((id) => {
          $(`#${id}`).value = "";
        });
    if (F.nums.plMin !== null || F.nums.plMax !== null)
      add("Filtres", `Joueurs : ${span(F.nums.plMin, F.nums.plMax)}`, clearIds("pl-min", "pl-max"));
    if (F.nums.tMin !== null || F.nums.tMax !== null)
      add("Filtres", `Durée : ${span(F.nums.tMin, F.nums.tMax, " min")}`, clearIds("t-min", "t-max"));
    if (F.nums.ageMax !== null) add("Filtres", `Âge ≤ ${F.nums.ageMax} ans`, clearIds("age-max"));
    if (F.nums.wMin !== null || F.nums.wMax !== null)
      add("Filtres", `Poids : ${span(F.nums.wMin, F.nums.wMax)}`, clearIds("w-min", "w-max"));
    for (const [k, name] of [
      ["av", "Note BGG"],
      ["b", "Note bayésienne"],
    ]) {
      if (app.rateActive(k))
        add("Filtres", `${name} : ${fr(FS.rate[k].lo.toFixed(1))} à ${fr(FS.rate[k].hi.toFixed(1))}`, () => {
          FS.rate[k].lo = FS.rate[k].min;
          FS.rate[k].hi = FS.rate[k].max;
          app.panel.rates.draw(k);
        });
    }
    if (FS.noFranchise) add("Filtres", "Sans franchise", () => app.setOpt("noFranchise", "no-franchise", false));
    if (FS.noReimpl) add("Filtres", "Sans réimplémentation", () => app.setOpt("noReimpl", "no-reimpl", false));
    if (FS.noExpLine) add("Filtres", "Sans extension (même gamme)", () => app.setOpt("noExpLine", "no-expline", false));
    if (state.signals && FS.sigFilter && (sigActive("wish") || sigActive("trade"))) {
      const iv = (k) => `c${sigInt[k][0]}–c${sigInt[k][1]}`;
      const parts = [
        sigActive("wish") ? `convoitise ${iv("wish")}` : null,
        sigActive("trade") ? `revente ${iv("trade")}` : null,
      ];
      add("Filtres", `Signaux : ${parts.filter(Boolean).join(", ")}`, () => {
        $("#sig-filter").checked = FS.sigFilter = false;
      });
    }
    for (const key of ATTR_KEYS) {
      for (const t of FS.req[key])
        add("Garder / exclure", `✓ ${ATTRS[key].dict[t]} (${ATTRS[key].short})`, () => {
          FS.req[key].delete(t);
          app.drawRequired();
        });
      for (const t of FS.ban[key])
        add(
          "Garder / exclure",
          `✕ ${ATTRS[key].dict[t]} (${ATTRS[key].short})`,
          () => {
            FS.ban[key].delete(t);
            app.drawRequired();
          },
          "ban",
        );
    }
    return out;
  }
  const fpop = $("#filter-pop");
  function drawFilterPop() {
    const list = activeFilters();
    const nPass = app.pass.reduce((a, b) => a + b, 0);
    const groups = [...new Set(list.map((x) => x.group))];
    fpop.innerHTML =
      (list.length
        ? groups
            .map(
              (gname) =>
                `<h4>${gname}</h4><ul>` +
                list
                  .map((x, j) =>
                    x.group === gname
                      ? `<li><span class="${x.cls}">${escapeHtml(x.text)}</span><button type="button" data-j="${j}" aria-label="Retirer ce filtre">✕</button></li>`
                      : "",
                  )
                  .join("") +
                "</ul>",
            )
            .join("")
        : "<h4>Aucun filtre actif</h4>") +
      `<p>${nPass} / ${N.length} jeux passent les filtres. Les voisins sont cherchés parmi eux ; le jeu choisi reste ` +
      `toujours affiché (contour pointillé s'il ne passe pas).</p>`;
    fpop.querySelectorAll("button[data-j]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        list[+b.dataset.j].clear();
        app.applyFilters();
        drawFilterPop();
      }),
    );
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
    const close = () => {
      ht = setTimeout(() => {
        fpop.hidden = true;
      }, 200);
    };
    sum.addEventListener("mouseenter", open);
    sum.addEventListener("mouseleave", close);
    fpop.addEventListener("mouseenter", () => clearTimeout(ht));
    fpop.addEventListener("mouseleave", close);
    window.addEventListener(
      "scroll",
      (e) => {
        if (!fpop.contains(e.target)) fpop.hidden = true;
      },
      true,
    );
  }
}
