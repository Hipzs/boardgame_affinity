/* Démarrage : jeu initial (hash ou Terraforming Mars), recentrage sur #id, nom d'onglet. */

export function install(app) {
  const { N, state, neighbors, resolve } = app;
  const fromHash = N.findIndex((g) => String(g.id) === location.hash.slice(1));
  app.applyFilters(); // filtres actifs dès le départ (signaux « Convoité, gardé » filtrés par défaut)
  const byDefault = resolve("Terraforming Mars"); // jeu affiché par défaut
  app.setCenter(fromHash >= 0 ? fromHash : byDefault >= 0 ? byDefault : 0);
  // Onglet nommé : les liens « Explorer » de la page « Mes collections » (target="bga-explorer") rouvrent cet onglet,
  // avec #id BGG dans l'adresse : on recentre sur ce jeu.
  window.name = "bga-explorer";
  // Temporaire (refactoring, étapes 2-3) : exposé pour comparer ce calcul à web/lib/ ; retiré à l'étape 10.
  window.__dbg = { neighbors: (u, cfg) => neighbors(u, cfg, false), getPass: () => app.pass, state };
  window.addEventListener("hashchange", () => {
    const j = N.findIndex((g) => String(g.id) === location.hash.slice(1));
    if (j >= 0 && j !== state.center) app.setCenter(j);
  });
}
