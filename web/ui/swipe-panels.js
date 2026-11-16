/* Téléphone (fenêtre ≤ 820 px) : les colonnes de <main> deviennent des pages plein écran qu'on fait défiler
 * horizontalement (swipe gauche / droite, défilement natif aimanté : scroll-snap). Une barre d'onglets au-dessus
 * indique la page visible et permet d'y sauter ; un point signale qu'une page a changé pendant qu'on était ailleurs
 * (ex. jeu cliqué dans le graphe -> point sur « Jeu »). Les colonnes gardent leur largeur réelle même hors écran :
 * le graphe et la carte (d3) se mesurent normalement. Styles : styles/11-mobile.css. */

/**
 * @typedef {{ el: Element | null, label: string, watch?: Element | null }} SwipePanel
 *   el : colonne (enfant direct de main) ; watch : zone dont un changement allume le point de l'onglet.
 */

const MOBILE = "(max-width: 820px)";

/**
 * @param {{ main: Element | null, panels: SwipePanel[], start?: number }} opts
 * @returns {{ show: (i: number, smooth?: boolean) => void, current: () => number } | null}
 */
export function installSwipePanels({ main: m, panels, start = 0 }) {
  if (!(m instanceof HTMLElement)) return null;
  const main = m;
  const list = panels.filter((p) => p.el && p.el.parentElement === main);
  if (list.length < 2) return null;
  const doc = main.ownerDocument;
  const els = list.map((p) => /** @type {HTMLElement} */ (p.el));

  main.classList.add("swipe-main");
  for (const el of els) el.classList.add("swipe-panel");

  const nav = doc.createElement("nav");
  nav.className = "swipe-nav";
  nav.setAttribute("aria-label", "Panneaux");
  const btns = list.map((p, i) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "swipe-tab";
    b.textContent = p.label;
    b.addEventListener("click", () => show(i));
    nav.appendChild(b);
    return b;
  });
  main.before(nav);

  // Bandes de bord (graphe, carte) : le d3.zoom capte les gestes sur le SVG ; ces bandes laissent passer le swipe.
  for (const el of els)
    for (const stage of el.querySelectorAll("[data-swipe-edges]"))
      for (const side of ["l", "r"]) {
        const d = doc.createElement("div");
        d.className = `swipe-edge ${side}`;
        d.setAttribute("aria-hidden", "true");
        stage.appendChild(d);
      }

  let cur = -1;
  const mq = window.matchMedia(MOBILE);

  function current() {
    const w = main.clientWidth || 1;
    return Math.max(0, Math.min(els.length - 1, Math.round(main.scrollLeft / w)));
  }
  /** @param {number} i */
  function mark(i) {
    if (i === cur) return;
    cur = i;
    btns.forEach((b, k) => {
      b.classList.toggle("on", k === i);
      b.setAttribute("aria-current", k === i ? "true" : "false");
      if (k === i) b.classList.remove("dot");
    });
  }
  /** @param {number} i @param {boolean} [smooth] */
  function show(i, smooth = true) {
    i = Math.max(0, Math.min(els.length - 1, i));
    if (mq.matches) main.scrollTo({ left: i * main.clientWidth, behavior: smooth ? "smooth" : "auto" });
    mark(i);
  }

  let raf = 0;
  main.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mark(current()));
    },
    { passive: true },
  );

  // Changement de taille / rotation : rester sur la même page.
  window.addEventListener("resize", () => {
    if (mq.matches) main.scrollLeft = Math.max(cur, 0) * main.clientWidth;
  });
  mq.addEventListener("change", () => show(Math.max(cur, 0), false));

  // Point « nouveau » sur l'onglet d'une page modifiée hors écran.
  list.forEach((p, k) => {
    if (!p.watch) return;
    new MutationObserver(() => {
      if (k !== cur && mq.matches) btns[k].classList.add("dot");
    }).observe(p.watch, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  });

  mark(start);
  requestAnimationFrame(() => show(start, false));
  return { show, current };
}
