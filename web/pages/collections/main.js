// @ts-check
/* Point d'entrée de « Mes collections » (collections.html) : liens d'en-tête, puis démarrage de la page. */
import { installTabLinks } from "../../ui/tab-links.js";
import { startCollections } from "./app.js";

installTabLinks();
startCollections();
