/* Démarrage : jeu initial (hash ou Terraforming Mars), recentrage sur #id, nom d'onglet. */
import { parseHash } from "../../lib/share-link.js";

export function install(app) {
  const { N, state, resolve } = app;
  const idOf = (/** @type {string} */ id) => N.findIndex((g) => String(g.id) === id);
  const { id, share } = parseHash(location.hash);
  const fromHash = idOf(id);
  if (share)
    app.applyShare(share); // lien partagé : réglages et filtres (applique aussi les filtres)
  else app.applyFilters(); // filtres actifs dès le départ (signaux « Convoité, gardé » filtrés par défaut)
  const byDefault = resolve("Terraforming Mars"); // jeu affiché par défaut
  app.setCenter(fromHash >= 0 ? fromHash : byDefault >= 0 ? byDefault : 0);
  // Onglet nommé : les liens « Explorer » de la page « Mes collections » (target="bga-explorer") rouvrent cet onglet,
  // avec #id BGG dans l'adresse : on recentre sur ce jeu (et on applique l'état si l'adresse est un lien partagé).
  window.name = "bga-explorer";
  window.addEventListener("hashchange", () => {
    const h = parseHash(location.hash);
    if (h.share) app.applyShare(h.share);
    const j = idOf(h.id);
    if (j >= 0 && (j !== state.center || h.share)) app.setCenter(j);
  });
}
