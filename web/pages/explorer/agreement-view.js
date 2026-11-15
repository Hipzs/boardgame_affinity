/* Comparateur : accord entre métriques et attributs, consensus, choix de la métrique. */
import { METRIC_KEYS, METRICS } from "../../lib/metrics.js";
import { agreementConfigs, consensus } from "../../lib/agreement.js";
import { $, escapeHtml } from "../../ui/html.js";

export function install(app) {
  const { hideHelp, N, ATTRS, ATTR_KEYS, state, attrWeights, currentCfg, neighbors, label } = app;
  Object.assign(app, { soloAttr, drawAgreement, setMetric }); // fonctions : disponibles dès le début (hissées)
  // --- Comparateur : accord entre métriques, puis entre attributs ---------------------------------------
  // Pour le jeu central : A[a][b] = |V_k^a ∩ V_k^b| / k (voisins communs, mêmes filtres, sans le mode pépites).
  //   métriques : les 4 métriques avec la pondération courante ; attributs : chaque attribut seul, métrique courante.
  // Consensus : jeux présents dans le top-k d'au moins la moitié des 8 configurations.
  const sel = $("#metric");
  sel.innerHTML = METRIC_KEYS.map((m) => `<option value="${m}">${METRICS[m].label}</option>`).join("");
  const metricHelp = () => `Métrique appliquée à chaque attribut : ${METRICS[state.metric].help}`;
  $("#metric-tool").dataset.help = metricHelp();
  function setMetric(m) {
    state.metric = m;
    sel.value = m;
    $("#metric-tool").dataset.help = metricHelp();
    app.invalidate();
  }
  sel.addEventListener("change", () => setMetric(sel.value));
  // Faire d'un attribut le seul critère (clic dans la matrice des attributs).
  function soloAttr(key) {
    for (const k of ATTR_KEYS) state.wRaw[k] = k === key ? 100 : 0;
    app.drawWeights();
    app.invalidate();
  }

  function agreementTable(confs, cur, onClick, k) {
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, 1]);
    const head = confs.map((c) => `<th scope="col" data-help="${escapeHtml(c.help)}">${c.short}</th>`).join("");
    const rows = confs
      .map(
        (a) =>
          `<tr${a.id === cur ? ' class="cur"' : ""}>` +
          `<th scope="row" data-id="${a.id}" data-help="${escapeHtml(onClick.help(a))}">${a.short}</th>` +
          confs
            .map((b) => {
              if (!a.top.length && !b.top.length) return "<td>–</td>";
              const B = new Set(b.top);
              const v = a.top.filter((x) => B.has(x)).length / k;
              const bg = color(0.15 + 0.85 * v);
              return `<td style="background:${bg};color:${app.textOn(bg)}" data-help="${escapeHtml(
                `${a.label} et ${b.label} : ${Math.round(v * k)} voisin(s) commun(s) sur ${k}.`,
              )}">${Math.round(v * 100)}</td>`;
            })
            .join("") +
          "</tr>",
      )
      .join("");
    return `<table class="agree"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function drawAgreement() {
    const box = $("#agree");
    if (state.center < 0 || box.closest("details").open === false) return;
    const u = state.center,
      k = Math.min(state.k, 30),
      base = currentCfg(); // top 30 au plus : matrices lisibles
    const top = (cfg) =>
      neighbors(u, cfg, false)
        .slice(0, k)
        .map((x) => x[0]);
    const { mConfs, aConfs } = agreementConfigs({ ATTRS, ATTR_KEYS, base, top });
    const w = attrWeights();
    const curAttr = ATTR_KEYS.find((x) => w[x] === 1);
    const { all, half, cons } = consensus(mConfs, aConfs);
    box.innerHTML = `
      <h3 data-help="Les 4 métriques avec la pondération courante des attributs.">Métriques</h3>
      ${agreementTable(mConfs, state.metric, { help: (a) => `Clic : utiliser la métrique « ${a.label} ».` }, k)}
      <h3 data-help="Chaque attribut pris seul, avec la métrique courante (${escapeHtml(METRICS[state.metric].label)}).">Attributs</h3>
      ${agreementTable(aConfs, curAttr, { help: (a) => `Clic : ne garder que « ${a.label} » comme critère.` }, k)}
      <p class="hint">Case = % de voisins communs (top ${k}) pour ${escapeHtml(N[u].n)}.</p>
      <h3 data-help="Jeux présents dans le top ${k} d'au moins ${half} des ${all.length} configurations (4 métriques + 4 attributs seuls) : recommandations robustes.">Consensus (≥ ${half}/${all.length})</h3>
      <ol class="nb-list">${
        cons
          .map(
            ([v, c]) =>
              `<li data-i="${v}" data-help="${escapeHtml(`Clic : recentrer. Présent pour ${c.n} configurations : ${c.ms.join(", ")} ; rang moyen ${(c.rk / c.n).toFixed(1)}.`)}">` +
              `<span>${escapeHtml(label(v))}</span><span class="score">${c.n}/${all.length}</span></li>`,
          )
          .join("") || '<li class="hint">aucun jeu commun à la moitié des configurations</li>'
      }</ol>`;
    const tables = box.querySelectorAll("table.agree");
    tables[0].querySelectorAll("th[data-id]").forEach((th) =>
      th.addEventListener("click", () => {
        hideHelp();
        setMetric(th.dataset.id);
      }),
    );
    tables[1].querySelectorAll("th[data-id]").forEach((th) =>
      th.addEventListener("click", () => {
        hideHelp();
        soloAttr(th.dataset.id);
      }),
    );
    box.querySelectorAll("li[data-i]").forEach((li) =>
      li.addEventListener("click", () => {
        hideHelp();
        app.setCenter(+li.dataset.i);
      }),
    );
  }
  $("#agree-box").addEventListener("toggle", drawAgreement);

  // Jeu initial : id BGG dans l'URL (#30549), sinon Terraforming Mars, sinon le plus noté.
}
