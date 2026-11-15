/* Overlay d'une collection (✎ ou double-clic) : renommer et choisir une couleur. */
import { $, escapeHtml as esc } from "../../ui/html.js";

export function install(app) {
  const { hideHelp, COLL } = app;
  Object.assign(app, { openCollPop }); // fonctions : disponibles dès le début (hissées)
  // --- Overlay d'une collection (bouton ✎ ou double-clic sur le nom) : renommer, choisir une couleur ----------
  // La couleur marque le cadre de la collection et ses étiquettes (fiches « Tous mes jeux », détails, explorateur).
  const PALETTE = [
    "#e8590c",
    "#f59f00",
    "#37b24d",
    "#0ca678",
    "#1098ad",
    "#1c7ed6",
    "#7048e8",
    "#ae3ec9",
    "#d6336c",
    "#868e96",
  ];
  const ctag = (c) =>
    `<span class="ctag${c.color ? " colored" : ""}"${c.color ? ` style="--cc:${c.color}"` : ""}>${esc(c.name)}</span>`;
  const pop = $("#coll-pop");
  function closeCollPop() {
    pop.hidden = true;
  }
  function openCollPop(cid, anchor) {
    const c = COLL.collections().find((x) => x.cid === cid);
    if (!c) return;
    hideHelp();
    let color = c.color || "";
    pop.innerHTML =
      `
      <label for="pop-name">Nom</label>
      <input id="pop-name" maxlength="60" autocomplete="off" value="${esc(c.name)}">
      <label>Couleur</label>
      <div class="swatches">${PALETTE.map((h) => `<button type="button" class="sw" data-c="${h}" style="--cc:${h}" aria-label="Couleur ${h}"></button>`).join("")}` +
      `<button type="button" class="sw none" data-c="" aria-label="Sans couleur" title="Sans couleur">∅</button></div>
      <div class="pop-act"><button type="button" class="secondary" data-a="cancel">Annuler</button><button type="button" data-a="ok">Valider</button></div>`;
    const mark = () => pop.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.c === color));
    mark();
    pop.querySelectorAll(".sw").forEach((b) =>
      b.addEventListener("click", () => {
        color = b.dataset.c;
        mark();
      }),
    );
    const name = pop.querySelector("#pop-name");
    const ok = () => {
      const v = name.value.trim();
      if (
        v &&
        v.toLowerCase() !== c.name.toLowerCase() &&
        COLL.collections().some((x) => x.cid !== cid && x.name.toLowerCase() === v.toLowerCase())
      ) {
        app.flash(`« ${v} » existe déjà.`, true);
        name.focus();
        return;
      }
      closeCollPop();
      COLL.updateCollection(cid, { name: v || c.name, color });
    };
    pop.querySelector('[data-a="ok"]').addEventListener("click", ok);
    pop.querySelector('[data-a="cancel"]').addEventListener("click", closeCollPop);
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ok();
    });
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, window.innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8)}px`;
    name.focus();
    name.select();
  }
  document.addEventListener("mousedown", (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("[data-ren]")) closeCollPop();
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !pop.hidden) {
        e.stopImmediatePropagation();
        closeCollPop();
      }
    },
    true,
  );

  Object.assign(app, { ctag });
}
