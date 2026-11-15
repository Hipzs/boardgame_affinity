// @ts-check
/* Aide au survol : tout élément [data-help] affiche son texte après un délai (souris, et clavier si followFocus). */

/**
 * @param {{el: HTMLElement, delay?: number, followFocus?: boolean, isSuppressed?: () => boolean}} o
 *   el : bulle ; delay : ms avant affichage ; followFocus : afficher au focus clavier et masquer au défilement ;
 *   isSuppressed : pas d'aide (par exemple pendant un glisser-déposer)
 */
export function installHelp({ el: help, delay = 300, followFocus = false, isSuppressed = () => false }) {
  /** @type {any} */ let timer = null;
  /** @type {Element | null} */ let helpFor = null;
  function show(el) {
    helpFor = el;
    help.textContent = el.dataset.help;
    help.hidden = false;
    const r = el.getBoundingClientRect();
    const w = help.offsetWidth,
      h = help.offsetHeight;
    const x = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    let y = r.bottom + 6;
    if (y + h > window.innerHeight - 8) y = r.top - h - 6; // au-dessus si pas la place en dessous
    help.style.left = `${x}px`;
    help.style.top = `${Math.max(8, y)}px`;
  }
  function hide() {
    clearTimeout(timer);
    help.hidden = true;
    helpFor = null;
  }
  document.addEventListener("mouseover", (e) => {
    const el = e.target instanceof Element ? e.target.closest("[data-help]") : null;
    if (el === helpFor) return;
    hide();
    if (!el || isSuppressed()) return;
    timer = setTimeout(() => show(el), delay);
  });
  document.addEventListener("mousedown", hide);
  if (followFocus) {
    document.addEventListener("focusin", (e) => {
      const el = e.target instanceof Element ? e.target.closest("[data-help]") : null;
      hide();
      if (el) show(el);
    });
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
  }
  return { show, hide };
}
