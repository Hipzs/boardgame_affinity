// @ts-check
/* Point d'entrée de l'explorateur (index.html) : liens d'en-tête, puis démarrage de la page. */
import { installTabLinks } from "../../ui/tab-links.js";
import { installSwipePanels } from "../../ui/swipe-panels.js";
import { startExplorer } from "./app.js";

installTabLinks();
startExplorer();
// Téléphone : une colonne à la fois, swipe gauche / droite (ouvre sur le graphe).
installSwipePanels({
  main: document.querySelector("main"),
  panels: [
    { el: document.querySelector("#panel"), label: "Filtres" },
    { el: document.querySelector("#graph-wrap"), label: "Graphe" },
    { el: document.querySelector("#info"), label: "Jeu", watch: document.querySelector("#details") },
  ],
  start: 1,
});
