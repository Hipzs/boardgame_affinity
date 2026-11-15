// @ts-check
/* Point d'entrée de l'explorateur (index.html) : liens d'en-tête, puis démarrage de la page. */
import { installTabLinks } from "../../ui/tab-links.js";
import { startExplorer } from "./app.js";

installTabLinks();
startExplorer();
