/* Collections proposées par défaut (même format que l'export JSON de « Mes collections ») :
 *   games       : [{id, added}]           jeux ajoutés (id = identifiant BGG)
 *   collections : [{name, color, games}]  games = ids BGG
 * Appliquées seulement au tout premier chargement (aucune donnée enregistrée dans ce navigateur) :
 * l'utilisateur peut ensuite les modifier ou les supprimer, elles ne reviennent pas.
 * Source : export « mes_collections_2026-11-14.json » (2 collections ; les jeux non rangés ne sont pas repris).
 * Pour les remplacer : « Exporter » dans Mes collections, puis recopier le contenu du fichier ici.
 */
window.BGA_DEFAULT_COLLECTIONS = {
  games: [],
  collections: [
    // Res Arcana / A Feast for Odin / Terraforming Mars
    {"name": "Best_template", "color": "#e8590c", "games": [262712, 177736, 167791]},
    // Detective: City of Angels / Tortuga 2199 / Pax Pamir: Second Edition / Frosthaven / Too Many Bones / Dice Throne / Aeon's End / Altar Quest
    {"name": "2Test_template", "color": "#1c7ed6", "games": [218074, 265017, 256960, 295770, 192135, 268201, 191189, 273703]},
  ],
};
