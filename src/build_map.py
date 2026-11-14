"""Cartes 2D des jeux (UMAP, sinon t-SNE) pour la vue « Carte » de l'interface : une carte par attribut.

Quatre cartes, chacune calculée avec un seul attribut à 100 % (les mêmes vecteurs que le cosinus IDF du navigateur) :
  m : mécaniques, IDF lissé sur tout le dump (supports < MIN_SUPPORT -> 0)
  c : thème (catégories BGG), idem
  f : familles fines, IDF lissé sur les jeux retenus (support ≥ 2, hors Admin:, Game:, …), comme web/app.js
  d : description, TF-IDF tronqué aux 40 mots les plus caractéristiques (export_web.description_vectors)
Vecteurs normalisés L2 ; distance cosinus d(u,v) = 1 − <x̂_u, x̂_v>, précalculée (jeu sans étiquette : distance 1 à tous).

Méthode : UMAP (umap-learn) si installé ; sinon t-SNE de scikit-learn (repli, plus lent, structure globale moins fidèle).
Cartes alignées par Procrustes sur la carte des mécaniques (orientation de t-SNE arbitraire : sans alignement,
la transition animée entre deux cartes tournoierait).

Sortie : data/processed/map_xy.csv (id, x0, y0, x1, y1, …) dans [-1, 1] environ, et map_xy.method
(ligne 1 : méthode, ligne 2 : clés des attributs dans l'ordre des colonnes, ex. m,c,f,d).
Usage : python3 src/build_map.py [--attrs m,c,f,d] [--min-ratings 500] [--method auto|umap|tsne]
"""
import argparse
import ast
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.linalg import orthogonal_procrustes
from sklearn.preprocessing import normalize

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_web import FAM_SKIP, clean_text, description_vectors  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "processed"
MIN_SUPPORT = 10
ATTR_NAMES = {"m": "mécaniques", "c": "thème", "f": "familles fines", "d": "description"}


def parse_list(s):
    return ast.literal_eval(s) if isinstance(s, str) else []


def weighted_matrix(lists_keep, w):
    """Matrice creuse jeux × étiquettes, poids w[t] (étiquettes de poids nul ignorées), lignes normalisées L2."""
    vocab = {t: j for j, t in enumerate(k for k, v in w.items() if v > 0)}
    rows, cols, vals = [], [], []
    for i, l in enumerate(lists_keep):
        for t in set(l):
            if t in vocab:
                rows.append(i); cols.append(vocab[t]); vals.append(w[t])
    X = sparse.csr_matrix((vals, (rows, cols)), shape=(len(lists_keep), len(vocab)))
    return normalize(X, norm="l2", axis=1)


def idf_dump(lists_all):
    """IDF lissé sur tout le dump (jeux ayant au moins une étiquette) ; supports < MIN_SUPPORT -> 0."""
    docs = [set(l) for l in lists_all if l]
    n = pd.Series([x for d in docs for x in d]).value_counts()
    w = np.log((len(docs) + 1) / (n + 1)) + 1.0
    w[n < MIN_SUPPORT] = 0.0
    return w.to_dict()


def idf_families(lists_keep):
    """IDF lissé des familles sur les jeux retenus (comme famIdf dans web/app.js) : support ≥ 2, hors FAM_SKIP."""
    n = pd.Series([x for l in lists_keep for x in set(l)]).value_counts()
    w = np.log((len(lists_keep) + 1) / (n + 1)) + 1.0
    w[(n < 2) | n.index.to_series().str.match(FAM_SKIP.pattern).values] = 0.0
    return w.to_dict()


def description_matrix(keep):
    words, rows = description_vectors(keep["description"].map(clean_text).tolist(), keep["primary"].tolist())
    r, c, v = [], [], []
    for i, row in enumerate(rows):
        for j, w in row:
            r.append(i); c.append(j); v.append(w)
    X = sparse.csr_matrix((v, (r, c)), shape=(len(rows), len(words)))
    return normalize(X, norm="l2", axis=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--attrs", default="m,c,f,d", help="attributs (m, c, f, d) ; une carte par attribut")
    ap.add_argument("--min-ratings", type=int, default=500)
    ap.add_argument("--method", default="auto", choices=["auto", "umap", "tsne"])
    a = ap.parse_args()
    attrs = a.attrs.split(",")

    d = pd.read_csv(RAW / "details.csv")
    r = pd.read_csv(RAW / "ratings.csv")[["id", "users_rated"]]
    d = d.merge(r, on="id", how="left")
    d["m"] = d["boardgamemechanic"].map(parse_list)
    d["c"] = d["boardgamecategory"].map(parse_list)
    d["f"] = d["boardgamefamily"].map(parse_list)
    keep = d[(d["users_rated"].fillna(0) >= a.min_ratings) & ((d["m"].map(len) > 0) | (d["c"].map(len) > 0))]
    keep = keep.reset_index(drop=True)
    build = {
        "m": lambda: weighted_matrix(keep["m"], idf_dump(d["m"])),
        "c": lambda: weighted_matrix(keep["c"], idf_dump(d["c"])),
        "f": lambda: weighted_matrix(keep["f"], idf_families(keep["f"])),
        "d": lambda: description_matrix(keep),
    }

    method = a.method
    if method == "auto":
        try:
            import umap  # noqa: F401
            method = "umap"
        except ImportError:
            method = "tsne"

    maps = {}
    for k in attrs:
        X = build[k]()
        # Distance cosinus précalculée (dense 4672² ≈ 175 Mo) : évite de densifier X (vocabulaire des descriptions).
        Dm = np.clip(1.0 - (X @ X.T).toarray(), 0.0, 1.0)
        np.fill_diagonal(Dm, 0.0)
        if method == "umap":
            import umap
            Y = umap.UMAP(n_neighbors=15, min_dist=0.1, metric="precomputed", random_state=0).fit_transform(Dm)
        else:
            from sklearn.manifold import TSNE
            Y = TSNE(n_components=2, metric="precomputed", perplexity=30, init="random", learning_rate="auto",
                     square_distances=True, random_state=0).fit_transform(Dm)
        Y = Y - np.median(Y, axis=0)
        maps[k] = Y / np.percentile(np.abs(Y), 99.5)  # robuste aux points isolés
        empty = int((X.getnnz(axis=1) == 0).sum())
        print(f"  {ATTR_NAMES[k]} : carte calculée ({empty} jeux sans étiquette)")

    ref = maps[attrs[0]]
    cols = {"id": keep["id"]}
    for j, k in enumerate(attrs):
        R, _ = orthogonal_procrustes(maps[k], ref)
        Y = maps[k] @ R
        cols[f"x{j}"], cols[f"y{j}"] = Y[:, 0].round(4), Y[:, 1].round(4)
    out = pd.DataFrame(cols)
    OUT.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT / "map_xy.csv", index=False)
    (OUT / "map_xy.method").write_text(f"{method}\n{','.join(attrs)}\n")
    print(f"{len(out)} jeux, méthode {method}, attributs {attrs} -> {OUT / 'map_xy.csv'}")


if __name__ == "__main__":
    main()
