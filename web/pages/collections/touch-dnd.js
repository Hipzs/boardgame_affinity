/* Glisser-déposer au doigt (téléphone, tablette) : appui long sur une fiche -> elle se soulève et suit le doigt,
 * un tiroir monte du bas avec une pastille par collection ; lâcher sur une pastille range le jeu (déplacé s'il vient
 * d'une collection, comme à la souris sans Ctrl). Appui long sans glisser : le tiroir reste ouvert, un tap sur une
 * pastille suffit. Événements tactiles seulement : la souris garde le glisser-déposer HTML5 (dnd.js). */
import { escapeHtml as esc } from "../../ui/html.js";

const HOLD_MS = 350; // durée de l'appui long
const SLOP = 10; // px : au-delà, avant l'appui long, c'est un défilement / swipe (on abandonne)

export function install(app) {
  const { byId, COLL, hideHelp } = app;
  /** @type {{id: number, from: string, card: HTMLElement, x: number, y: number, timer: any} | null} */
  let press = null; // appui en cours, pas encore long
  /** @type {{id: number, from: string, card: HTMLElement, moved: boolean, held: boolean} | null} */
  let drag = null; // appui long déclenché : fiche soulevée, tiroir ouvert
  let ghost = /** @type {HTMLElement | null} */ (null);
  let closeT = /** @type {any} */ (null);
  let grab = { dx: 0 }; // point de prise (horizontal) dans la fiche : le fantôme reste aligné sur le doigt

  const tray = document.createElement("div");
  tray.id = "touch-tray";
  tray.className = "touch-tray";
  tray.setAttribute("role", "dialog");
  tray.setAttribute("aria-label", "Ranger le jeu dans une collection");
  tray.hidden = true;
  document.body.append(tray);

  function drawTray() {
    if (!drag) return;
    const g = byId.get(drag.id);
    const chips = COLL.collections()
      .filter((c) => c.cid !== drag?.from)
      .map(
        (c) =>
          `<button type="button" class="tray-chip${c.color ? " colored" : ""}" data-to="${c.cid}"` +
          `${c.color ? ` style="--cc:${c.color}"` : ""}>${esc(c.name)} <span class="n">${c.games.length}</span></button>`,
      );
    if (drag.from) chips.unshift(`<button type="button" class="tray-chip inbox" data-to="">↩ Nouveaux jeux</button>`);
    tray.innerHTML =
      `<p class="tray-title">Ranger <b>${esc(g ? g.n : `Jeu ${drag.id}`)}</b> dans :</p>` +
      `<div class="tray-chips">${chips.join("")}` +
      `<button type="button" class="tray-chip new" data-to="new">＋ Nouvelle</button></div>` +
      `<button type="button" class="tray-close" data-close aria-label="Annuler">✕</button>`;
  }

  function lift(/** @type {NonNullable<typeof press>} */ p) {
    press = null;
    clearTimeout(closeT);
    hideHelp();
    drag = { id: p.id, from: p.from, card: p.card, moved: false, held: false };
    app.dragging = drag; // coupe l'aide au survol
    p.card.classList.add("lifted");
    ghost = /** @type {HTMLElement} */ (p.card.cloneNode(true));
    ghost.className = "gcard touch-ghost";
    ghost.removeAttribute("data-help");
    const r = p.card.getBoundingClientRect();
    grab = { dx: p.x - r.left };
    ghost.style.width = `${r.width}px`;
    document.body.append(ghost);
    moveGhost(p.x, p.y);
    drawTray();
    tray.hidden = false;
    document.body.classList.add("is-touch-dragging");
    navigator.vibrate?.(15);
  }

  function moveGhost(/** @type {number} */ x, /** @type {number} */ y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${x - grab.dx}px, ${y - ghost.offsetHeight - 24}px)`; // au-dessus du doigt : la pastille visée reste visible
  }

  const chipAt = (/** @type {number} */ x, /** @type {number} */ y) =>
    /** @type {HTMLElement | null} */ (document.elementFromPoint(x, y)?.closest(".tray-chip") ?? null);

  function hover(/** @type {HTMLElement | null} */ chip) {
    tray.querySelectorAll(".tray-chip.over").forEach((c) => c !== chip && c.classList.remove("over"));
    chip?.classList.add("over");
  }

  function endDrag() {
    ghost?.remove();
    ghost = null;
    drag?.card.classList.remove("lifted");
    drag = null;
    app.dragging = null;
    document.body.classList.remove("is-touch-dragging");
  }

  function close() {
    endDrag();
    tray.hidden = true;
  }

  /** Applique le rangement vers la pastille ; affiche le résultat dans le tiroir puis le ferme. */
  function drop(/** @type {HTMLElement} */ chip) {
    if (!drag) return;
    const { id, from } = drag;
    let to = chip.dataset.to ?? "";
    if (to === "new") {
      endDrag(); // la fenêtre de saisie interrompt le geste
      const g = byId.get(id);
      const name = (prompt("Nom de la nouvelle collection :", "") || "").trim();
      if (!name) return close();
      const same = COLL.collections().find((c) => c.name.toLowerCase() === name.toLowerCase());
      to = same ? same.cid : COLL.createCollection(name);
      COLL.move(id, from || null, to);
      return done(`${g ? g.n : `Jeu ${id}`} → ${name}`);
    }
    const c = COLL.collections().find((x) => x.cid === to);
    const g = byId.get(id);
    endDrag();
    COLL.move(id, from || null, to || null);
    done(`${g ? g.n : `Jeu ${id}`} → ${c ? c.name : "Nouveaux jeux"}`);
  }

  function done(/** @type {string} */ text) {
    tray.hidden = false;
    tray.innerHTML = `<p class="tray-done">✓ ${esc(text)}</p>`;
    app.flash(text);
    clearTimeout(closeT);
    closeT = setTimeout(() => (tray.hidden = true), 1400);
  }

  // --- Gestes -----------------------------------------------------------------------------------------------
  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1 || drag) return;
      const t = e.touches[0];
      const target = /** @type {Element} */ (e.target);
      const card = /** @type {HTMLElement | null} */ (target.closest?.(".gcard[data-id]") ?? null);
      if (!card || target.closest("a, button, input")) return;
      const p = {
        id: Number(card.dataset.id),
        from: card.dataset.from || "",
        card,
        x: t.clientX,
        y: t.clientY,
        timer: /** @type {any} */ (null),
      };
      p.timer = setTimeout(() => press === p && lift(p), HOLD_MS);
      press = p;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (press && Math.hypot(t.clientX - press.x, t.clientY - press.y) > SLOP) {
        clearTimeout(press.timer); // c'est un défilement : le navigateur le gère
        press = null;
      }
      if (!drag || drag.held) return; // tiroir en attente d'un tap : gestes normaux
      e.preventDefault(); // fiche soulevée : ni défilement ni swipe
      drag.moved = true;
      moveGhost(t.clientX, t.clientY);
      hover(chipAt(t.clientX, t.clientY));
    },
    { passive: false },
  );
  const release = (/** @type {TouchEvent} */ e) => {
    if (press) {
      clearTimeout(press.timer);
      press = null;
    }
    if (!drag || drag.held) return; // tap dans le tiroir : le clic doit passer
    e.preventDefault(); // pas de clic (ouverture du détail) à la fin de l'appui long
    const t = e.changedTouches[0];
    const chip = drag.moved && e.type === "touchend" ? chipAt(t.clientX, t.clientY) : null;
    if (chip) return drop(chip);
    if (drag.moved) return close(); // lâché hors d'une pastille : annulé
    // Appui long sans glisser : la fiche reste soulevée, le tiroir attend un tap.
    drag.held = true;
    ghost?.remove();
    ghost = null;
  };
  document.addEventListener("touchend", release, { passive: false });
  document.addEventListener("touchcancel", release, { passive: false });
  // Appui long : pas de menu contextuel ni de glisser HTML5 natif pendant le geste.
  document.addEventListener("contextmenu", (e) => {
    if (press || drag) e.preventDefault();
  });
  document.addEventListener(
    "dragstart",
    (e) => {
      if (press || drag) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  // Tiroir ouvert sans glisser : tap sur une pastille, sur ✕, ou ailleurs (= annuler).
  tray.addEventListener("click", (e) => {
    const el = /** @type {Element} */ (e.target);
    if (el.closest("[data-close]")) return close();
    const chip = /** @type {HTMLElement | null} */ (el.closest(".tray-chip"));
    if (chip && drag) drop(chip);
  });
  document.addEventListener(
    "click",
    (e) => {
      if (drag && !tray.contains(/** @type {Node} */ (e.target))) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !tray.hidden) close();
  });
}
