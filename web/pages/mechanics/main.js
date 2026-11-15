// @ts-check
/* Point d'entrée de la carte des mécaniques (mechanics.html) : liens d'en-tête, puis démarrage. */
import { installTabLinks } from "../../ui/tab-links.js";
import { startMechanics } from "./heatmap.js";

installTabLinks();
startMechanics();
