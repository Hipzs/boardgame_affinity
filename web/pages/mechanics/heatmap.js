/* Carte de chaleur des mécaniques : co-occurrences (web/lib/cooccurrence.js), ordre et groupes par classification. */
import { buildCooccurrence, cluster, lift, npmi, topTags } from "../../lib/cooccurrence.js";
import { installHelp } from "../../ui/help-tooltip.js";
import { $, escapeHtml as esc } from "../../ui/html.js";

const CELL = 13; // côté d'une case (px)
const LABEL = 215; // largeur des libellés de lignes (px)
const TOP = 200; // hauteur des libellés de colonnes (px)
const METRIC_HELP = {
  npmi: "NPMI = ln(P(a,b) / (P(a)P(b))) / (−ln P(a,b)) : 1 = toujours ensemble, 0 = indépendantes, −1 = jamais ensemble. Insensible à la fréquence des mécaniques.",
  lift: "Lift = P(a,b) / (P(a)P(b)), échelle log₂ : +1 = deux fois plus fréquentes ensemble que par hasard, −1 = deux fois moins. Gonflé par les mécaniques rares.",
  count: "Nombre de jeux qui ont les deux mécaniques. Reflète surtout la popularité des mécaniques.",
};
const hue = (/** @type {number} */ g) => `hsl(${Math.round((g * 137.5) % 360)} 55% 50%)`;

export function startMechanics() {
  const w = /** @type {any} */ (window);
  if (!w.BGG_DATA) {
    const msg = $("#mh-msg");
    msg.textContent = "Données absentes : lancer python3 src/export_web.py.";
    msg.classList.add("err");
    return;
  }
  installHelp({ el: $("#help"), delay: 400 });
  const D = w.BGG_DATA;
  const names = /** @type {string[]} */ (D.dict.mech);
  const co = buildCooccurrence(D.nodes, names.length);
  const nMax = Math.min(120, topTags(co.count, 1000, 2).length);
  $("#mh-n").max = String(nMax);
  const ui = { metric: "npmi", n: Math.min(40, nMax), min: 5, k: 6 };
  $("#mh-n").value = String(ui.n);
  /** @type {{tags: number[], order: number[], groups: number[]} | null} */
  let layout = null; // recalculé quand n ou k change

  /** Valeur d'une paire (a, b) selon la métrique, ramenée à [−1, 1] pour la couleur. */
  function cellValue(a, b) {
    const n = co.pair(a, b);
    if (ui.metric === "count") return { v: Math.sqrt(n / Math.max(1, Math.min(co.count[a], co.count[b]))), n };
    if (ui.metric === "lift") {
      const l = lift(co, a, b);
      return { v: l ? Math.max(-1, Math.min(1, Math.log2(l) / 3)) : -1, n };
    }
    return { v: npmi(co, a, b), n };
  }

  function computeLayout() {
    const tags = topTags(co.count, ui.n, 2);
    const { order, cut } = cluster(tags.length, (i, j) => 1 - npmi(co, tags[i], tags[j]));
    const groups = cut(ui.k);
    layout = { tags: order.map((i) => tags[i]), order, groups: order.map((i) => groups[i]) };
  }

  function draw() {
    if (!layout) computeLayout();
    const { tags, groups } = /** @type {NonNullable<typeof layout>} */ (layout);
    const n = tags.length;
    const W = LABEL + n * CELL + 4,
      H = TOP + n * CELL + 4;
    let s = "";
    for (let i = 0; i < n; i++) {
      const y = TOP + i * CELL,
        x = LABEL + i * CELL;
      s += `<rect class="mh-grp" x="${LABEL - 8}" y="${y}" width="5" height="${CELL - 1}" fill="${hue(groups[i])}"/>`;
      s += `<text class="mh-lab" x="${LABEL - 12}" y="${y + CELL - 3}" text-anchor="end">${esc(names[tags[i]])}</text>`;
      s += `<rect class="mh-grp" x="${x}" y="${TOP - 8}" width="${CELL - 1}" height="5" fill="${hue(groups[i])}"/>`;
      s += `<text class="mh-lab" transform="translate(${x + CELL - 3},${TOP - 12}) rotate(-90)">${esc(names[tags[i]])}</text>`;
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = LABEL + j * CELL,
          y = TOP + i * CELL;
        if (i === j) {
          s += `<rect class="mh-diag" x="${x}" y="${y}" width="${CELL - 1}" height="${CELL - 1}" data-i="${i}" data-j="${j}"/>`;
          continue;
        }
        const { v, n: c } = cellValue(tags[i], tags[j]);
        if (c < ui.min) {
          s += `<rect class="mh-low" x="${x}" y="${y}" width="${CELL - 1}" height="${CELL - 1}" data-i="${i}" data-j="${j}"/>`;
          continue;
        }
        const cls = ui.metric === "count" ? "mh-cnt" : v >= 0 ? "mh-pos" : "mh-neg";
        s += `<rect class="${cls}" x="${x}" y="${y}" width="${CELL - 1}" height="${CELL - 1}" fill-opacity="${Math.min(1, Math.abs(v)).toFixed(2)}" data-i="${i}" data-j="${j}"/>`;
      }
    const svg = $("#mh-svg");
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    $("#mh-n-out").textContent = String(n);
    $("#mh-min-out").textContent = String(ui.min);
    $("#mh-k-out").textContent = String(new Set(groups).size);
    $("#mh-metric-help").textContent = METRIC_HELP[/** @type {keyof typeof METRIC_HELP} */ (ui.metric)];
    $("#mh-stats").textContent =
      `${n} mécaniques sur ${names.length} (les plus fréquentes), ${D.nodes.length} jeux. ` +
      `Cases claires : moins de ${ui.min} jeux en commun (valeur peu fiable).`;
    // Groupes : mécaniques de chaque groupe, de la plus fréquente à la moins fréquente.
    const byGroup = new Map();
    tags.forEach((t, i) => byGroup.set(groups[i], [...(byGroup.get(groups[i]) || []), t]));
    $("#mh-groups").innerHTML = [...byGroup]
      .map(
        ([g, ts]) =>
          `<div class="mh-gbox"><span class="mh-gdot" style="background:${hue(g)}"></span>` +
          ts
            .sort((a, b) => co.count[b] - co.count[a])
            .map((t) => `<span class="chip">${esc(names[t])}</span>`)
            .join("") +
          `</div>`,
      )
      .join("");
  }

  const tip = $("#mh-tip");
  const cellAt = (/** @type {Event} */ e) => {
    const r = /** @type {Element} */ (e.target).closest("rect[data-i]");
    if (!r || !layout) return null;
    const i = Number(r.getAttribute("data-i")),
      j = Number(r.getAttribute("data-j"));
    return { a: layout.tags[i], b: layout.tags[j] };
  };
  const factText = (/** @type {number} */ a, /** @type {number} */ b) =>
    a === b
      ? `${esc(names[a])} : ${co.count[a]} jeux`
      : `<b>${esc(names[a])}</b> + <b>${esc(names[b])}</b><br>${co.pair(a, b)} jeux en commun · lift ×${lift(co, a, b).toFixed(2)} · NPMI ${npmi(co, a, b).toFixed(2)}`;
  $("#mh-svg").addEventListener("mousemove", (e) => {
    const c = cellAt(e);
    tip.hidden = !c;
    if (!c) return;
    tip.innerHTML = factText(c.a, c.b);
    const box = /** @type {HTMLElement} */ ($("#mh-scroll")).getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX - box.left + 14, box.width - 260)}px`;
    tip.style.top = `${e.clientY - box.top + 14}px`;
  });
  $("#mh-svg").addEventListener("mouseleave", () => (tip.hidden = true));
  $("#mh-svg").addEventListener("click", (e) => {
    const c = cellAt(e);
    if (!c) return;
    const hit = D.nodes.filter((/** @type {any} */ g) => g.m.includes(c.a) && g.m.includes(c.b)); // déjà triés par nombre d'avis
    $("#mh-detail").innerHTML =
      `<h2>${c.a === c.b ? esc(names[c.a]) : `${esc(names[c.a])} + ${esc(names[c.b])}`}</h2><p class="hint">${factText(c.a, c.b)}</p>` +
      `<ol class="sugg-list">${hit
        .slice(0, 40)
        .map(
          (/** @type {any} */ g) =>
            `<li class="sugg-row mh-game"><a class="sugg-name" href="index.html#${g.id}">${esc(g.n)}${g.y ? ` <span class="yr">${g.y}</span>` : ""}</a>` +
            `<span class="gmeta">★ ${g.av.toFixed(1)} · ${g.r.toLocaleString("fr-FR")} avis</span></li>`,
        )
        .join("")}</ol>` +
      (hit.length > 40 ? `<p class="hint">… et ${hit.length - 40} autres (les plus évalués sont listés).</p>` : "");
  });

  $("#mh-metric").addEventListener("change", (e) => {
    ui.metric = /** @type {HTMLSelectElement} */ (e.target).value;
    draw();
  });
  for (const [id, key, relayout] of /** @type {[string, "n" | "min" | "k", boolean][]} */ ([
    ["mh-n", "n", true],
    ["mh-min", "min", false],
    ["mh-k", "k", true],
  ]))
    $(`#${id}`).addEventListener("input", (e) => {
      ui[key] = Number(/** @type {HTMLInputElement} */ (e.target).value);
      if (relayout) layout = null;
      draw();
    });
  $("#mh-min-out").textContent = String(ui.min);
  $("#mh-k").value = String(ui.k);
  draw();
}
