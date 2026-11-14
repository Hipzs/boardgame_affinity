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
python3 -m http.server 8765 --directory web
```

Puis ouvrir http://localhost:8765. La bibliothèque d3 est chargée depuis cdnjs (connexion internet nécessaire).

## Structure

```
src/
  download_data.sh   téléchargement du dump
  build_matrix.py    matrice binaire jeux x mécaniques, fréquences, IDF
  similarity.py      prototypes de similarité en Python (Jaccard, cosinus IDF, SVD)
  build_map.py       cartes 2D (t-SNE, ou UMAP si installé), alignées par Procrustes
  export_web.py      export des données pour l'interface
web/
  index.html, style.css, app.js
```

## Source et licence des données

Données BoardGameGeek via [TidyTuesday 2022-01-25](https://github.com/rfordatascience/tidytuesday/tree/master/data/2022/2022-01-25). Usage non commercial ; BoardGameGeek doit être cité comme source.
