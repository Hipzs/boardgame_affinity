/* Glisser-déposer : ranger, déplacer, copier, réordonner les collections. */
import { $ } from "../../ui/html.js";

export function install(app) {
  const { hideHelp, byId, COLL } = app;
  // --- Glisser-déposer (délégation sur le document : survit aux redessins) --------------------------------
  app.dragging = null;
  // Réordonner les collections : glisser l'en-tête d'un cadre (poignée ⠿) et le déposer avant / après un autre.
  // Position : moitié gauche / droite du cadre visé si la grille a plusieurs colonnes, sinon moitié haute / basse.
  let collDrop = null; // {cid, before}
  const clearCollMarks = () =>
    document
      .querySelectorAll(".coll-box.drop-before, .coll-box.drop-after")
      .forEach((b) => b.classList.remove("drop-before", "drop-after"));
  function collDropAt(e) {
    const box = e.target.closest && e.target.closest(".coll-box");
    if (!box) return null;
    const r = box.getBoundingClientRect();
    const cols = getComputedStyle($("#colls")).gridTemplateColumns.split(" ").length;
    const before = cols > 1 ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    return { box, cid: box.dataset.drop, before, vert: cols === 1 };
  }
  document.addEventListener("dragstart", (e) => {
    const head = e.target.closest && !e.target.closest(".gcard") && e.target.closest(".coll-head");
    if (head) {
      hideHelp();
      app.dragging = { coll: head.dataset.cid };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(app.dragging));
      head.closest(".coll-box").classList.add("dragging");
      document.body.classList.add("is-dragging-coll");
      return;
    }
    const card = e.target.closest && e.target.closest(".gcard");
    if (!card) return;
    hideHelp();
    app.dragging = { id: +card.dataset.id, from: card.dataset.from };
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", JSON.stringify(app.dragging));
    card.classList.add("dragging");
    document.body.classList.add("is-dragging");
  });
  document.addEventListener("dragend", (e) => {
    const card = e.target.closest && e.target.closest(".gcard");
    if (card) card.classList.remove("dragging");
    document.querySelectorAll(".dropzone.over").forEach((z) => z.classList.remove("over"));
    document.querySelectorAll(".coll-box.dragging").forEach((b) => b.classList.remove("dragging"));
    clearCollMarks();
    document.body.classList.remove("is-dragging", "is-dragging-coll");
    app.dragging = null;
    collDrop = null;
  });
  const zoneOf = (e) => e.target.closest && e.target.closest(".dropzone");
  const isCopy = (e) => e.ctrlKey || e.altKey || e.metaKey;
  document.addEventListener("dragover", (e) => {
    if (app.dragging && app.dragging.coll) {
      const t = collDropAt(e);
      clearCollMarks();
      if (!t || t.cid === app.dragging.coll) {
        collDrop = null;
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      t.box.classList.add(t.before ? "drop-before" : "drop-after");
      t.box.classList.toggle("vert", t.vert);
      collDrop = t;
      return;
    }
    const z = zoneOf(e);
    if (!z || !app.dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = app.dragging.from && z.dataset.drop && isCopy(e) ? "copy" : "move";
    document.querySelectorAll(".dropzone.over").forEach((x) => {
      if (x !== z) x.classList.remove("over");
    });
    z.classList.add("over");
  });
  document.addEventListener("dragleave", (e) => {
    const z = zoneOf(e);
    if (z && !z.contains(e.relatedTarget)) z.classList.remove("over");
  });
  document.addEventListener("drop", (e) => {
    if (app.dragging && app.dragging.coll) {
      e.preventDefault();
      const t = collDrop;
      clearCollMarks();
      if (!t) return;
      const ids = COLL.collections().map((c) => c.cid);
      const after = ids[ids.indexOf(t.cid) + 1] || null; // déposer « après » = avant le suivant
      const beforeCid = t.before ? t.cid : after === app.dragging.coll ? ids[ids.indexOf(t.cid) + 2] || null : after;
      COLL.reorderCollection(app.dragging.coll, beforeCid);
      return;
    }
    const z = zoneOf(e);
    if (!z) return;
    e.preventDefault();
    z.classList.remove("over");
    let d = app.dragging;
    try {
      d = d || JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (!d) return;
    const to = z.dataset.drop || null,
      from = d.from || null;
    if (to === from) return;
    if (!to) {
      if (from) COLL.move(d.id, from, null);
      return;
    } // vers « Nouveaux jeux » : sortir de la collection
    COLL.move(d.id, from, to, isCopy(e));
    const c = COLL.collections().find((x) => x.cid === to),
      g = byId.get(d.id);
    app.flash(`${g ? g.n : `Jeu ${d.id}`} → ${c ? c.name : ""}${from && isCopy(e) ? " (copié)" : ""}`);
  });
}
