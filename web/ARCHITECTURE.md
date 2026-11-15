# Architecture de `web/`

Interface statique (aucun serveur applicatif, aucun bundler) : modules ES natifs, JSDoc vérifié par `tsc`, d3 7.9 par CDN (global `d3`).
Données : `web/data/games.js` (gitignoré, produit par `src/export_web.py`) pose `window.BGG_DATA`.

## Carte des modules

```
web/
  index.html  collections.html     balisage : conteneurs + 3 scripts (d3, data/games.js, pages/*/main.js)
  style.css                        liste d'@import vers styles/NN-*.css (ORDRE = cascade : ne pas réordonner)
  emoji.js  default-collections.js données éditables à la main (export const EMOJI / DEFAULT_COLLECTIONS)
  types.d.ts  globals.d.ts         types partagés (Game, RawData, FilterState, Attr…), globales (BGG_DATA, d3)
  lib/    logique PURE : ni document, ni window, ni localStorage (règle eslint) -> testable sous Node
  ui/     composants DOM réutilisables par les deux pages
  pages/explorer/    pages/collections/    orchestrateurs : un module par zone de l'écran
```

| `lib/`                       | rôle                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dataset`                    | index et libellés dérivés de BGG_DATA (`loadDataset`, `TAG_KEYS`, `FAM_SKIP`)                                                                                      |
| `attrs`                      | 4 attributs (méca., thème, familles, description) : vecteurs IDF, listes inversées, cosinus souple                                                                 |
| `metrics`                    | 4 métriques (cos, jac, ovl, soft), `attrPair`, pondération des attributs                                                                                           |
| `neighbors`                  | top-K voisins d'un jeu parmi ceux qui passent les filtres, avec cache (`invalidate()` à chaque changement)                                                         |
| `bfs`                        | budget (≤ 300 nœuds), `worst`, `maxDepth`, `maxK`, parcours en largeur `expand`                                                                                    |
| `filters`                    | **état unique des filtres** (`createFilterState`) et **prédicat unique `passes`** pour les deux pages ; `filterCount`, `resetFilters`, `includeTag` / `excludeTag` |
| `active-filters`             | liste des filtres actifs avec la fonction qui retire chacun (sans DOM)                                                                                             |
| `keywords`                   | recherche par mots-clés (texte normalisé, « -mot » exclut)                                                                                                         |
| `signals`, `gems`            | convoitise / revente (centiles), « pépites cachées »                                                                                                               |
| `emoji-index`, `map-centers` | émoji par thème, centres des thèmes sur les cartes                                                                                                                 |
| `agreement`                  | accord entre métriques et attributs, consensus                                                                                                                     |
| `collection-store`           | store « Mes collections » (stockage, collections par défaut, horloge injectés)                                                                                     |
| `ui-persistence`             | état mémorisé de la page collections (clé `bga.collections.ui.v1`)                                                                                                 |
| `store`                      | mini-store observable                                                                                                                                              |

| `ui/`                 | rôle                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `html`                | `escapeHtml`, `fr`, `$`, gabarit auto-échappant `` html`…` ``, délégation `on()`                                                        |
| `help-tooltip`        | aide au survol (`data-help`)                                                                                                            |
| `dual-range`          | curseur double : glisser la bande déplace l'intervalle                                                                                  |
| `filter-panel/`       | **panneau Filtres généré** (balisage, curseurs de note, champs d'étiquettes, saisie anti-rebond) pour les deux pages (`mode: "explorer" | "collections"`) |
| `collection-instance` | le store « Mes collections » du navigateur (localStorage + collections par défaut)                                                      |
| `tab-links`           | liens d'en-tête : remet au premier plan l'onglet déjà ouvert                                                                            |

`pages/explorer/` : `core` (données, état, voisins), `filters`, `graph-view`, `map-view`, `details`, `export-collections`,
`toolbar`, `signals-ui`, `weights-ui`, `active-filters-pop`, `agreement-view`, `start`, assemblés par `app.js`.
`pages/collections/` : `core`, `filters`, `cards`, `detail`, `card-actions`, `collection-popover`, `sections`, `dnd`,
`collection-from-filters`, `actions`, `start`, assemblés par `app.js`.

## Flux

```
saisie / clic  ->  module de page (écouteur)  ->  état (state, FS = FilterState)
                                                   |
        explorateur : applyFilters -> computePass -> neighbors (lib) -> render -> graph-view | map-view ; details ; agreement
        collections : draw -> passes (lib) -> fiches, détails, compteurs
```

Les modules d'une page ne s'importent pas entre eux : `createApp()` (core.js) construit un objet `app` (données, état,
caches) et chaque `install(app)` y branche ses vues puis y dépose les fonctions que les autres appellent (`app.render()`,
`app.select(i)`…). L'ordre d'installation (`pages/*/app.js`) est celui du démarrage ; une fonction n'est appelable par un
module précédent qu'au moment d'un événement, jamais pendant l'installation.

## Conventions

- Un fichier ≈ une zone ou une responsabilité, ≲ 350 lignes. La logique de calcul va dans `lib/` (pure), jamais dans une page.
- `lib/` et `ui/` sont typés strictement (`noImplicitAny`, `tsconfig.strict.json`) ; les pages passent `checkJs` sans `noImplicitAny`.
- `$("#id")` est typé `any` : les ids viennent du balisage (testé par `tests/unit/filter-panel-markup.test.js`).
- Tout HTML construit avec des données passe par `escapeHtml` / `` html`…` ``.
- Pas de `?v=N` : `web/serve.py` désactive le cache.

## Contrats à ne pas casser

- localStorage : `bga.collections.v2` (migration depuis `bga.collection.v1`), `bga.collections.ui.v1`, `bga.reqsec.<sec>`.
- URL : `#<id BGG>` recentre l'explorateur. `window.name` : `bga-explorer`, `bga-collection`.
- Export JSON v2 : `{version: 2, games: [{id, added}], collections: [{cid, name, color, created, games}]}`.
- Collections par défaut : semées au tout premier chargement seulement.

## Recettes

- **Ajouter un filtre** : champ dans `ui/filter-panel/markup.js` (+ lecture/écriture dans `filter-panel.js`), état dans
  `lib/filters.js` (`createFilterState`, `passes`, `filterCount`, `resetFilters`), texte dans `lib/active-filters.js`, test dans
  `tests/unit/filters.test.js`.
- **Ajouter un bouton de barre (explorateur)** : id dans `index.html`, écouteur dans `pages/explorer/toolbar.js` (ou le module de la zone), `app.render()` ou `app.invalidate()` pour recalculer.
- **Ajouter une métrique** : `lib/metrics.js` (`METRICS`, `attrPair`) + test ; le sélecteur et le comparateur la prennent seuls.
- **Changer le CSS** : fichier de `styles/` concerné ; vérifier `tests/e2e/visual.spec.js`.

## Vérifier

```bash
npm run check        # tsc (pages + strict lib/ui), eslint, prettier
npm test             # tests unitaires (node:test) sur lib/ et ui/
npm run test:e2e     # Playwright sur la fixture (tests/fixtures/games.small.js)
npm run test:e2e:real   # idem sur les vraies données (baseline.json, empreintes)
```

Après un nouvel export des données : `npm run fixture` puis `npm run baseline`.
Les empreintes (`tests/e2e/fingerprint*.spec.js`) enregistrent le comportement visible des deux pages : `--update-snapshots`
seulement si le changement est voulu.
