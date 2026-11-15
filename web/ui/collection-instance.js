// @ts-check
/* Le store « Mes collections » du navigateur, partagé par les deux pages : stockage local, collections par défaut
 * (premier chargement seulement) et synchronisation entre onglets par l'événement « storage ». */
import { createCollectionStore } from "../lib/collection-store.js";
import { DEFAULT_COLLECTIONS } from "../default-collections.js";

/** @type {Storage | null} */
let storage = null;
try {
  storage = localStorage;
} catch {
  /* stockage bloqué : le store se replie sur la mémoire */
}

export const COLL = createCollectionStore({
  storage,
  defaults: DEFAULT_COLLECTIONS,
  addStorageListener: (cb) => window.addEventListener("storage", (e) => cb(e.key ?? "")),
});
