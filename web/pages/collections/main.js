// @ts-check
/* Point d'entrée de « Mes collections » (collections.html) : démarrage de la page. */
import { installSwipePanels } from "../../ui/swipe-panels.js";
import { startCollections } from "./app.js";

startCollections();
// Téléphone : une colonne à la fois, swipe gauche / droite (ouvre sur les collections).
installSwipePanels({
  main: document.querySelector("main"),
  panels: [
    { el: document.querySelector(".filt-panel"), label: "Filtres" },
    { el: document.querySelector(".inbox-panel"), label: "Nouveaux" },
    { el: document.querySelector(".colls-panel"), label: "Collections" },
    { el: document.querySelector(".gdetail-panel"), label: "Jeu", watch: document.querySelector("#gdetail") },
  ],
  start: 2,
});
