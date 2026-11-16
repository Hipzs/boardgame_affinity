// @ts-check
/* Point d'entrée de la carte des mécaniques (mechanics.html) : liens d'en-tête, puis démarrage. */
import { installTabLinks } from "../../ui/tab-links.js";
import { installSwipePanels } from "../../ui/swipe-panels.js";
import { startMechanics } from "./heatmap.js";

installTabLinks();
startMechanics();
// Téléphone : une colonne à la fois, swipe gauche / droite (ouvre sur la carte).
installSwipePanels({
  main: document.querySelector("main"),
  panels: [
    { el: document.querySelector(".mech-ctl"), label: "Réglages" },
    { el: document.querySelector(".mech-map"), label: "Carte" },
    { el: document.querySelector("#mh-detail"), label: "Détail", watch: document.querySelector("#mh-detail") },
  ],
  start: 1,
});
