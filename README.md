# boardgame_affinity

Interface web d'exploration de jeux de société par ressemblance : graphe des plus proches voisins et carte 2D, à partir des données BoardGameGeek.

- **Attributs** comparés : mécaniques, thème (catégories BGG), familles fines, description (mots-clés TF-IDF).
- **Métriques** : cosinus IDF, Jaccard, recouvrement, cosinus souple (co-occurrences NPMI).
- **Filtres** : garder / exclure des étiquettes, famille, auteur, illustrateur, éditeur, joueurs, durée, âge, notes, franchise, réimplémentations, convoitise et revente (intervalles de centiles).
- **Vues** : graphe (parcours en largeur des k plus proches voisins), une carte t-SNE par attribut seul (mécaniques, thème, familles, description), comparateur d'accord entre métriques et attributs, mode « pépites cachées ».

## Installation et données

Python 3 avec `pandas`, `numpy`, `scipy`, `scikit-learn`. Les données ne sont pas versionnées : elles se téléchargent puis se régénèrent.

```bash
bash src/download_data.sh          # dump BGG (TidyTuesday 2022-01-25) -> data/raw/
python3 src/build_matrix.py        # matrice jeux x mécaniques -> data/processed/
python3 src/build_map.py           # 4 cartes 2D t-SNE, une par attribut (≈ 1 min) -> data/processed/map_xy.csv
python3 src/export_web.py          # attributs, NPMI, descriptions -> web/data/games.js
```

## Lancer l'interface

```bash
python3 web/serve.py 8765        # ou : npm run serve (sans cache navigateur)
```

Puis ouvrir http://localhost:8765 (pages : explorateur `index.html`, `collections.html`, carte des mécaniques `mechanics.html`). La bibliothèque d3 est chargée depuis cdnjs (connexion internet nécessaire).

## Développement

```bash
npm install          # une fois (typescript, eslint, prettier, playwright)
npm run check        # types, lint, format
npm test             # tests unitaires (logique pure de web/lib)
npm run test:e2e     # tests bout en bout sur la fixture (npx playwright install chromium la 1re fois)
```

Architecture et conventions : [web/ARCHITECTURE.md](web/ARCHITECTURE.md).

## Structure

```
src/
  download_data.sh   téléchargement du dump
  build_matrix.py    matrice binaire jeux x mécaniques, fréquences, IDF
  similarity.py      prototypes de similarité en Python (Jaccard, cosinus IDF, SVD)
  build_map.py       cartes 2D (t-SNE, ou UMAP si installé), alignées par Procrustes
  compare_maps.py    compare deux cartes (trustworthiness, recall@k, corrélation des distances)
  export_web.py      export des données pour l'interface
web/
  index.html, collections.html, mechanics.html    pages (balisage)
  lib/ ui/ pages/ styles/           code : voir web/ARCHITECTURE.md
  serve.py                          serveur de dev sans cache
tests/
  unit/ e2e/ fixtures/              node:test, Playwright, petite fixture de données
```

## Source et licence des données

Données BoardGameGeek via [TidyTuesday 2022-01-25](https://github.com/rfordatascience/tidytuesday/tree/master/data/2022/2022-01-25). Usage non commercial ; BoardGameGeek doit être cité comme source.
