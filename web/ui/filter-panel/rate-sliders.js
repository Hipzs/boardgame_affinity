// @ts-check
/* Curseurs de note (BGG et bayésienne) : intervalle [lo, hi] dans F.rate, pas de 0,1 (valeurs ×10 dans les <input range>).
 * Glisser la bande entre les poignées déplace tout l'intervalle. */
import { createBandDrag } from "../dual-range.js";
import { rateActive } from "../../lib/filters.js";

/**
 * @param {any} F  FilterState
 * @param {{onChange: () => void, hideHelp: () => void, debounce?: number}} o  onChange : appelé après `debounce` ms
 */
export function createRateSliders(F, { onChange, hideHelp, debounce = 150 }) {
  const $ = (s) => /** @type {HTMLInputElement} */ (document.querySelector(s));
  function draw(k) {
    const R = F.rate[k],
      box = $(`#${k}-int`);
    $(`#${k}-lo`).value = String(Math.round(R.lo * 10));
    $(`#${k}-hi`).value = String(Math.round(R.hi * 10));
    $(`#${k}-lo`).style.zIndex = R.lo > (R.min + R.max) / 2 ? "3" : "1";
    const pos = (v) => `${(100 * (v - R.min)) / (R.max - R.min)}%`;
    box.style.setProperty("--lo", pos(R.lo));
    box.style.setProperty("--hi", pos(R.hi));
    box.classList.toggle("inactive", !rateActive(F, k));
    $(`#${k}-out`).textContent = rateActive(F, k) ? `${R.lo.toFixed(1)} → ${R.hi.toFixed(1)}` : "toutes";
  }
  /** @type {any} */ let timer;
  const changed = (k) => {
    draw(k);
    clearTimeout(timer);
    timer = setTimeout(onChange, debounce);
  };
  for (const k of ["av", "b"]) {
    const R = F.rate[k];
    for (const end of ["lo", "hi"]) {
      const el = $(`#${k}-${end}`);
      el.min = String(Math.round(R.min * 10));
      el.max = String(Math.round(R.max * 10));
      el.step = "1";
      el.addEventListener("input", () => {
        const v = +el.value / 10;
        if (end === "lo") R.lo = Math.min(v, R.hi);
        else R.hi = Math.max(v, R.lo);
        changed(k);
      });
    }
    createBandDrag($(`#${k}-int`), {
      min: R.min,
      max: R.max,
      step: 0.1,
      onStart: hideHelp,
      get: () => [R.lo, R.hi],
      set: (lo, hi) => {
        R.lo = lo;
        R.hi = hi;
        changed(k);
      },
    });
    draw(k);
  }
  return { draw, drawAll: () => ["av", "b"].forEach(draw) };
}
