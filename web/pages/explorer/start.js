/* Démarrage : jeu initial (hash ou Terraforming Mars), recentrage sur #id, nom d'onglet. */

export function install(app) {
  const { N, state, resolve } = app;
  const fromHash = N.findIndex((g) => String(g.id) === location.hash.slice(1));
  app.applyFilters(); // filtres actifs dès le départ (signaux « Convoité, gardé » filtrés par défaut)
  const byDefault = resolve("Terraforming Mars"); // jeu affiché par défaut
  app.setCenter(fromHash >= 0 ? fromHash : byDefault >= 0 ? byDefault : 0);
  // Onglet nommé : les liens « Explorer » de la page « Mes collections » (target="bga-explorer") rouvrent cet onglet,
  // avec #id BGG dans l'adresse : on recentre sur ce jeu.
  window.name = "bga-explorer";
  window.addEventListener("hashchange", () => {
    const j = N.findIndex((g) => String(g.id) === location.hash.slice(1));
    if (j >= 0 && j !== state.center) app.setCenter(j);
  });
}
