/* « 💡 Suggestions » d'une collection : jeux hors collection les plus proches de son profil (web/lib/suggest.js),
 * affichés dans la colonne de droite. Respecte les filtres de gauche. */
import { buildAttrs } from "../../lib/attrs.js";
import { suggest } from "../../lib/suggest.js";
import { $, escapeHtml as esc } from "../../ui/html.js";

const LIMIT = 20;

export function install(app) {
  const { D, domEmo, COLL } = app;
  Object.assign(app, { drawSuggestions });
  /** Collection dont on affiche les suggestions (cid), ou null. */
  app.sugg = null;
  /** @type {ReturnType<typeof buildAttrs> | null} */
  let attrs = null; // construit au premier clic seulement (quelques centaines de ms)
  const idxOf = new Map(D.nodes.map((g, i) => [g.id, i]));

  function drawSuggestions() {
    const box = $("#gdetail");
    const c = COLL.collections().find((x) => x.cid === app.sugg);
    if (!c) {
      app.sugg = null;
      return app.drawDetail();
    }
    attrs = attrs || buildAttrs(D);
    const F = app.readF();
    F.active = app.filterCount(F) > 0;
    const members = c.games.map((id) => idxOf.get(id)).filter((i) => i !== undefined);
    // Les jeux déjà dans mes autres collections restent proposables ; ceux de cette collection sont exclus par suggest().
    const pass = Uint8Array.from(D.nodes, (g) => (app.passes(g, F) ? 1 : 0));
    const rows = suggest({
      ATTRS: attrs.ATTRS,
      ATTR_KEYS: attrs.ATTR_KEYS,
      members,
      pass,
      limit: LIMIT,
    });
    const names = { m: "méca.", c: "thème", f: "familles", d: "descr." };
    box.innerHTML = `
      <h2>💡 Suggestions <button type="button" class="cbtn" data-sugg-close title="Fermer">✕</button></h2>
      <p class="hint">Pour « ${esc(c.name)} » (${members.length} jeu${members.length > 1 ? "x" : ""}) : jeux hors de la collection
        les plus proches de son profil moyen${F.active ? ", parmi ceux qui passent les filtres" : ""}.</p>
      ${
        members.length
          ? `<ol class="sugg-list">${
              rows
                .map((r) => {
                  const g = D.nodes[r.i];
                  const top = Object.entries(r.parts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                    .map(([k, v]) => `${names[k]} ${Math.round(100 * v)}`)
                    .join(" · ");
                  return (
                    `<li class="sugg-row" data-id="${g.id}">` +
                    `<span class="sugg-score" data-help="Cosinus pondéré entre le jeu et le profil de la collection (0–100).">${Math.round(100 * r.score)}</span>` +
                    `<a class="sugg-name" href="#" data-open="${g.id}"><span class="emo">${domEmo(g)}</span> ${esc(g.n)}${g.y ? ` <span class="yr">${g.y}</span>` : ""}</a>` +
                    `<span class="gmeta">★ ${g.av.toFixed(1)} · ${esc(top)}</span>` +
                    `<button type="button" class="secondary sugg-add" data-add="${g.id}" title="Ajouter à « ${esc(c.name)} »">＋</button>` +
                    `<a href="index.html#${g.id}" target="bga-explorer" title="Ouvrir dans l'explorateur">↗</a></li>`
                  );
                })
                .join("") || '<li class="hint">Aucun jeu ne passe les filtres.</li>'
            }</ol>`
          : '<p class="hint">Cette collection est vide : ajoute-lui des jeux pour obtenir des suggestions.</p>'
      }`;
  }

  document.addEventListener("click", (e) => {
    const t = /** @type {Element} */ (e.target);
    const b = t.closest("[data-sugg]");
    if (b) {
      app.sugg = /** @type {HTMLElement} */ (b).dataset.sugg;
      app.hideHelp();
      drawSuggestions();
      return;
    }
    if (t.closest("[data-sugg-close]")) {
      app.sugg = null;
      app.drawDetail();
      return;
    }
    const add = t.closest("[data-add]");
    if (add && app.sugg) {
      COLL.addMany([Number(/** @type {HTMLElement} */ (add).dataset.add)], app.sugg); // onChange -> draw -> liste recalculée
      return;
    }
    const open = t.closest("[data-open]");
    if (open) {
      e.preventDefault();
      app.sugg = null;
      app.selected = Number(/** @type {HTMLElement} */ (open).dataset.open);
      app.drawDetail();
    }
  });
}
