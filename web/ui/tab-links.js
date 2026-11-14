/* Liens d'en-tête « Explorateur » / « Mes collections » (target nommé) : si l'onglet visé est déjà ouvert sur la
 * bonne page, on le met au premier plan sans le recharger (son état est conservé) ; sinon, navigation normale. */
export function installTabLinks(doc = document) {
  doc.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a.tab[target^='bga-']") : null;
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    const url = new URL(a.getAttribute("href") || "", location.href);
    if (url.hash) return; // lien vers un jeu précis (#id) : navigation normale (hashchange, sans rechargement)
    let w = null;
    try {
      w = window.open("", /** @type {HTMLAnchorElement} */ (a).target);
    } catch {
      return;
    }
    if (!w) return;
    e.preventDefault();
    let same = false;
    try {
      same = w.location.pathname === url.pathname;
    } catch {
      /* autre origine */
    }
    if (!same) w.location.href = url.href;
    w.focus();
  });
}
