/* Point d'entrée de l'explorateur (index.html). Étape de transition : app.js reste un script classique qui lit
 * encore des globales ; ce module les pose puis le charge. Les ponts disparaissent à l'étape 10. */
import { EMOJI } from "../../emoji.js";
import { DEFAULT_COLLECTIONS } from "../../default-collections.js";
import { createCollectionStore } from "../../lib/collection-store.js";
import { installTabLinks } from "../../ui/tab-links.js";

window.BGG_EMOJI = EMOJI;
window.BGG_COLLECTION = createCollectionStore({
  storage: localStorage,
  defaults: DEFAULT_COLLECTIONS,
  addStorageListener: (cb) => window.addEventListener("storage", (e) => cb(e.key)),
});
installTabLinks();

const s = document.createElement("script");
s.src = "app.js";
document.body.append(s);
