/* Panneau Filtres de la page : Garder / exclure (fréquences de mes jeux), ET / OU, étiquettes, overlay des filtres actifs. */
import { TAG_KEYS, TAG_NAMES } from "../../lib/dataset.js";
import { $, escapeHtml as esc } from "../../ui/html.js";
import { createFilterPanel } from "../../ui/filter-panel/filter-panel.js";

export function install(app) {
  const {
    hideHelp,
    D,
    REQ,
    REQ_SHOW,
    FS,
    req,
    ban,
    tags,
    notTags,
    modeReq,
    modeTag,
    expanded,
    RATE,
    rateActive,
    NUM_IDS,
    mine,
    reqTerms,
    readF,
    passes,
    nReqBan,
    filterCount,
    EMO,
  } = app;
  Object.assign(app, { drawRequired, drawTagFilters, activeFilters, drawFilterPop }); // fonctions : disponibles dès le début (hissées)
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
  const panel = createFilterPanel($("#filter-panel"), {
    mode: "collections",
    D,
    F: FS,
    hideHelp,
    debounce: 200,
    onChange: () => app.draw(),
    afterKeywords: F_SAVE_HTML,
    suggestions: (k) => {
      const freq = new Map();
      mine().forEach((g) => g[k].forEach((t) => freq.set(t, (freq.get(t) || 0) + 1)));
      return [...freq].sort((a, b) => b[1] - a[1]);
    },
  });
  // Garder / exclure : pastilles à trois états, sur toutes les étiquettes de mes jeux.
  function drawRequired() {
    const G = mine();
    // Compteur de chaque étiquette : nombre de mes jeux qui passent les filtres actifs et l'ont (0 = estompée).
    // L'ordre reste celui de la fréquence sur tous mes jeux, pour que les pastilles ne sautent pas.
    const F = readF();
    F.active = filterCount(F) > 0;
    const GF = F.active ? G.filter((g) => passes(g, F)) : G;
    for (const k of Object.keys(REQ)) {
      const freq = new Map(),
        cnt = new Map();
      G.forEach((g) => reqTerms(g, k).forEach((t) => freq.set(t, (freq.get(t) || 0) + 1)));
      GF.forEach((g) => reqTerms(g, k).forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1)));
      const order = [...freq]
        .sort((a, b) => b[1] - a[1] || D.dict[REQ[k].dict][a[0]].localeCompare(D.dict[REQ[k].dict][b[0]]))
        .map((x) => x[0]);
      const active = new Set([...req[k], ...ban[k]]);
      const shown = expanded[k] ? order : order.slice(0, REQ_SHOW);
      const extra = [...active].filter((t) => !shown.includes(t)); // actives toujours visibles
      const more = order.length - shown.length;
      const box = $(`#req-${k}`);
      box.innerHTML =
        [...shown, ...extra]
          .map((t) => {
            const st = req[k].has(t) ? "on" : ban[k].has(t) ? "ban" : "";
            const name = D.dict[REQ[k].dict][t];
            const help =
              st === "on"
                ? "Indispensable : chaque jeu affiché doit l'avoir. Clic : revenir à neutre ; croix : l'interdire."
                : st === "ban"
                  ? "Interdite : aucun jeu affiché ne doit l'avoir. Clic ou croix : revenir à neutre."
                  : "Neutre. Clic : la rendre indispensable ; croix à droite : l'interdire.";
            const em = k === "m" ? app.mechEmo(name) : k === "c" ? EMO.themes[name] || "" : "";
            const n = cnt.get(t) || 0,
              tot = freq.get(t) || 0;
            const nTxt = F.active
              ? `${n} des ${GF.length} jeux affichés (${tot} de tous tes jeux)`
              : `${tot} de tes jeux`;
            return (
              `<span class="chip toggle${st ? ` ${st}` : ""}${n ? "" : " zero"}" data-t="${t}" role="button" tabindex="0" data-help="${esc(`${help} (${nTxt})`)}">` +
              `${em ? `<span class="emo">${em}</span>` : ""}${esc(name)} <span class="cnt">${n}</span>` +
              `<span class="ban-x" aria-label="Interdire" data-help="${st === "ban" ? "Retirer l'interdiction." : "Interdire : aucun jeu affiché ne doit l'avoir."}">✕</span></span>`
            );
          })
          .join("") +
          (more > 0
            ? `<span class="chip more" data-more="${k}" role="button" tabindex="0" data-help="Afficher les ${order.length} étiquettes.">+ ${more}</span>`
            : expanded[k] && order.length > REQ_SHOW
              ? `<span class="chip more" data-more="${k}" role="button" tabindex="0" data-help="N'afficher que les ${REQ_SHOW} plus fréquentes.">−</span>`
              : "") || '<span class="hint">aucune</span>';
      box.querySelectorAll(".chip.toggle").forEach((ch) => {
        const t = +ch.dataset.t;
        const toggleReq = () => {
          if (!ban[k].delete(t)) {
            if (!req[k].delete(t)) req[k].add(t);
          }
          hideHelp();
          app.draw();
        };
        const toggleBan = () => {
          if (!ban[k].delete(t)) {
            req[k].delete(t);
            if (k === "f") tags.f.delete(t);
            ban[k].add(t);
          }
          hideHelp();
          app.draw();
        };
        ch.addEventListener("click", (e) => (e.target.closest(".ban-x") ? toggleBan() : toggleReq()));
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
      const mb = box.querySelector(".chip.more");
      if (mb) {
        const go = () => {
          expanded[k] = !expanded[k];
          hideHelp();
          drawRequired();
        };
        mb.addEventListener("click", go);
        mb.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            go();
          }
        });
      }
    }
    $("#req-count").textContent = nReqBan() || "";
    // Une rubrique repliée qui contient un filtre actif se rouvre (filtre posé depuis le jeu affiché, par ex.).
    for (const k of Object.keys(REQ))
      if (req[k].size || ban[k].size) {
        const d = document.querySelector(`details.req-sec[data-sec="${k}"]`);
        if (d && !d.open) d.open = true;
      }
    for (const k of Object.keys(REQ)) {
      const n = new Set(mine().flatMap((g) => reqTerms(g, k))).size,
        a = req[k].size + ban[k].size;
      $(`#sec-n-${k}`).textContent = a ? `${n} · ${a} actif${a > 1 ? "s" : ""}` : n || "";
    }
  }
  $("#req-clear").addEventListener("click", () => {
    Object.keys(REQ).forEach((k) => {
      req[k].clear();
      ban[k].clear();
    });
    app.draw();
  });

  // Petites étiquettes ET / OU à côté des titres de rubrique : clic = bascule.
  function modeBtn(store, k, where) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mode-tag";
    const draw1 = () => {
      const and = store[k] === "and";
      b.textContent = and ? "ET" : "OU";
      b.classList.toggle("and", and);
      b.dataset.help = and
        ? "ET : le jeu doit avoir toutes les étiquettes choisies dans cette rubrique. Clic : passer en OU."
        : "OU : le jeu doit avoir au moins une des étiquettes choisies dans cette rubrique. Clic : passer en ET.";
    };
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); // dans un <summary> : ne pas replier la rubrique
      store[k] = store[k] === "and" ? "or" : "and";
      draw1();
      hideHelp();
      app.draw();
    });
    b.redraw = draw1;
    draw1();
    where.appendChild(b);
    return b;
  }
  const modeBtns = [];
  for (const k of Object.keys(modeReq))
    modeBtns.push(modeBtn(modeReq, k, document.querySelector(`details.req-sec[data-sec="${k}"] > summary h3`)));
  for (const k of Object.keys(modeTag)) {
    const lab = document.querySelector(`.tagfilter[data-key="${k}"] > label`);
    modeBtns.push(modeBtn(modeTag, k, lab));
  }

  // Champs d'étiquettes (famille, auteur, illustrateur, éditeur) : suggestions = étiquettes de mes jeux.
  function drawTagFilters() {
    panel.tags.drawSuggestions();
    panel.tags.drawAllChips();
  }
  $("#reset").addEventListener("click", () => {
    NUM_IDS.forEach((id) => {
      $(`#${id}`).value = "";
    });
    $("#f-kw").value = "";
    Object.values(tags).forEach((x) => x.clear());
    Object.values(notTags).forEach((x) => x.clear());
    for (const k of ["av", "b"]) {
      RATE[k].lo = RATE[k].min;
      RATE[k].hi = RATE[k].max;
      panel.rates.draw(k);
    }
    app.draw(); // « Garder / exclure » n'est pas touché : bouton « Effacer »
  });

  // Overlay des filtres actifs (survol du mot « Filtres »), comme dans l'explorateur ; ✕ pour en retirer un.
  const fr = (x) => String(x).replace(".", ",");
  function activeFilters() {
    const out = [],
      F = readF();
    const add = (group, text, clear, cls = "") => out.push({ group, text, clear, cls });
    if (F.kw.length)
      add("Mots-clés", `« ${$("#f-kw").value.trim()} »`, () => {
        $("#f-kw").value = "";
      });
    for (const k of Object.keys(REQ)) {
      for (const t of req[k])
        add(
          "Garder / exclure",
          `✓ ${D.dict[REQ[k].dict][t]} (${REQ[k].label}${modeReq[k] === "or" && req[k].size > 1 ? ", OU" : ""})`,
          () => req[k].delete(t),
        );
      for (const t of ban[k])
        add("Garder / exclure", `✕ ${D.dict[REQ[k].dict][t]} (${REQ[k].label})`, () => ban[k].delete(t), "ban");
    }
    for (const [k, name] of [
      ["av", "Note BGG"],
      ["b", "Note bayésienne"],
    ]) {
      if (rateActive(k))
        add("Filtres", `${name} : ${fr(RATE[k].lo.toFixed(1))} à ${fr(RATE[k].hi.toFixed(1))}`, () => {
          RATE[k].lo = RATE[k].min;
          RATE[k].hi = RATE[k].max;
          panel.rates.draw(k);
        });
    }
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
    if (F["pl-min"] !== null || F["pl-max"] !== null)
      add("Filtres", `Joueurs : ${span(F["pl-min"], F["pl-max"])}`, clearIds("pl-min", "pl-max"));
    if (F["t-min"] !== null || F["t-max"] !== null)
      add("Filtres", `Durée : ${span(F["t-min"], F["t-max"], " min")}`, clearIds("t-min", "t-max"));
    if (F["age-max"] !== null) add("Filtres", `Âge ≤ ${F["age-max"]} ans`, clearIds("age-max"));
    for (const k of Object.keys(TAG_KEYS))
      for (const t of tags[k])
        add(
          "Filtres",
          `${TAG_NAMES[k]} : ${D.dict[TAG_KEYS[k]][t]}${modeTag[k] === "and" && tags[k].size > 1 ? " (ET)" : ""}`,
          () => tags[k].delete(t),
        );
    for (const k of Object.keys(notTags))
      for (const t of notTags[k])
        add("Filtres", `✕ ${TAG_NAMES[k]} : ${D.dict[TAG_KEYS[k]][t]}`, () => notTags[k].delete(t), "ban");
    return out;
  }
  const fpop = $("#filter-pop");
  function drawFilterPop() {
    const list = activeFilters();
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
                      ? `<li><span class="${x.cls}">${esc(x.text)}</span><button type="button" data-j="${j}" aria-label="Retirer ce filtre">✕</button></li>`
                      : "",
                  )
                  .join("") +
                "</ul>",
            )
            .join("")
        : "<h4>Aucun filtre actif</h4>") + `<p>${$("#f-stats").textContent}</p>`;
    fpop.querySelectorAll("button[data-j]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        list[+b.dataset.j].clear();
        app.draw();
        drawFilterPop();
      }),
    );
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
    const close = () => {
      ht2 = setTimeout(() => {
        fpop.hidden = true;
      }, 200);
    };
    sum.addEventListener("mouseenter", open);
    sum.addEventListener("mouseleave", close);
    fpop.addEventListener("mouseenter", () => clearTimeout(ht2));
    fpop.addEventListener("mouseleave", close);
  }

  Object.assign(app, { panel, modeBtns, fpop });
}
