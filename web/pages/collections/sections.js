/* Sections « Garder / exclure » repliables (état mémorisé). */

export function install() {
  // --- Sections Garder / exclure repliables (état mémorisé dans ce navigateur) ---------------------------------
  document.querySelectorAll("details.req-sec").forEach((d) => {
    const key = `bga.reqsec.${/** @type {HTMLElement} */ (d).dataset.sec}`;
    try {
      if (localStorage.getItem(key) === "0") /** @type {HTMLDetailsElement} */ (d).open = false;
    } catch {
      /* stockage indisponible */
    }
    d.addEventListener("toggle", () => {
      try {
        localStorage.setItem(key, /** @type {HTMLDetailsElement} */ (d).open ? "1" : "0");
      } catch {
        /* idem */
      }
    });
  });
}
