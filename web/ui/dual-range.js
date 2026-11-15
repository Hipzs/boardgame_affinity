// @ts-check
/* Curseurs à deux poignées : glisser la bande entre les poignées déplace tout l'intervalle.
 * Largeur (haut − bas) conservée ; l'intervalle bute sur les bords. Les poignées gardent leur rôle habituel
 * (les <input> ne captent que leurs poignées : un appui ailleurs dans la boîte arrive ici). */

/**
 * @param {HTMLElement} box  conteneur des deux <input type=range>
 * @param {{min: number, max: number, step: number, get: () => [number, number], set: (lo: number, hi: number) => void, onStart?: () => void}} o
 */
export function createBandDrag(box, { min, max, step, get, set, onStart }) {
  const frac = (/** @type {PointerEvent} */ e) => {
    const r = box.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  const inBand = (/** @type {PointerEvent} */ e) => {
    const [lo, hi] = get(),
      x = min + frac(e) * (max - min);
    return hi > lo && x > lo && x < hi;
  };
  /** @type {{f0: number, iv: [number, number]} | null} */
  let drag = null;
  box.addEventListener("pointermove", (e) => {
    if (drag) {
      const [lo0, hi0] = drag.iv,
        w = hi0 - lo0;
      let d = Math.round(((frac(e) - drag.f0) * (max - min)) / step) * step;
      d = Math.max(min - lo0, Math.min(max - hi0, d));
      const lo = +(lo0 + d).toFixed(6);
      set(lo, +(lo + w).toFixed(6));
      return;
    }
    box.style.cursor = e.target === box && inBand(e) ? "grab" : "";
  });
  box.addEventListener("pointerdown", (e) => {
    if (e.target !== box || !inBand(e)) return;
    e.preventDefault();
    onStart?.();
    drag = { f0: frac(e), iv: get() };
    try {
      box.setPointerCapture(e.pointerId);
    } catch {
      /* pointeur sans capture possible */
    }
    box.classList.add("dragging");
    box.style.cursor = "grabbing";
  });
  const end = () => {
    drag = null;
    box.classList.remove("dragging");
    box.style.cursor = "";
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
}
