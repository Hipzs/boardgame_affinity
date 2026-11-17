/* Démarrage : jeu initial (hash, vue mémorisée ou Terraforming Mars), recentrage sur #id, mémorisation de la vue. */
import { SEP, encodeView, parseHash } from "../../lib/share-link.js";

/** Vue de l'explorateur mémorisée pour l'onglet (`<id>~<état>`, même encodage que « Lien 🔗 ») : les pages
 * s'ouvrent toutes dans le même onglet, on retrouve donc la vue en revenant de « Mes collections » ou « Mécaniques ». */
const VIEW_KEY = "bga.explorer.view.v1";

export function install(app) {
  const { N, state, sigInt, FS, resolve } = app;
  const idOf = (/** @type {string} */ id) => N.findIndex((g) => String(g.id) === id);
  const { id, share } = parseHash(location.hash);
  /** @type {{id: string, share: string | null}} */
  let saved = { id: "", share: null };
  try {
    saved = parseHash(sessionStorage.getItem(VIEW_KEY) || "");
  } catch {
    /* stockage indisponible : on part des valeurs par défaut */
  }
  const fromShare = share || saved.share; // lien partagé, sinon vue mémorisée
  if (fromShare)
    app.applyShare(fromShare); // réglages et filtres (applique aussi les filtres)
  else app.applyFilters(); // filtres actifs dès le départ (signaux « Convoité, gardé » filtrés par défaut)
  const byDefault = resolve("Terraforming Mars"); // jeu affiché par défaut
  const start = [idOf(id), share ? -1 : idOf(saved.id), byDefault].find((j) => j >= 0);
  app.setCenter(start ?? 0);

  function saveView() {
    const gid = N[state.center]?.id;
    if (gid === undefined) return;
    try {
      app.readFilters(); // saisie en cours (anti-rebond) incluse
      sessionStorage.setItem(VIEW_KEY, `${gid}${SEP}${encodeView({ state, sigInt, F: FS })}`);
    } catch {
      /* stockage plein ou indisponible : vue non mémorisée */
    }
  }
  window.addEventListener("pagehide", saveView);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveView();
  });

  // Liens « Explorer ↗ » des autres pages : #id BGG dans l'adresse ; un changement de hash sur place recentre sur ce
  // jeu (et applique l'état si l'adresse est un lien partagé).
  window.addEventListener("hashchange", () => {
    const h = parseHash(location.hash);
    if (h.share) app.applyShare(h.share);
    const j = idOf(h.id);
    if (j >= 0 && (j !== state.center || h.share)) app.setCenter(j);
  });
}
