"""Carte 2D des jeux (UMAP, sinon t-SNE) pour la vue « Carte » de l'interface.

Vecteur d'un jeu : concaténation [√α · x̂_méca , √(1−α) · x̂_catég], où x̂ est le vecteur IDF lissé normalisé L2.
Alors <z_u, z_v> = α·cos_méca + (1−α)·cos_catég : chaque carte respecte la similarité du graphe pour son α.
Métrique : cosinus.

Méthode : UMAP (umap-learn) si installé ; sinon t-SNE de scikit-learn (repli, plus lent, structure globale moins fidèle).

Une carte par valeur de α (défaut 0, 0,25, 0,5, 0,75, 1), alignées par Procrustes sur celle de α = 0,5.
Sortie : data/processed/map_xy.csv (id, x0, y0, x1, y1, …) dans [-1, 1] environ, et map_xy.method
(ligne 1 : méthode, ligne 2 : liste des α).
Usage : python3 src/build_map.py [--alphas 0,0.25,0.5,0.75,1] [--min-ratings 500] [--method auto|umap|tsne]
"""
import argparse
import ast
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.linalg import orthogonal_procrustes
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "processed"
MIN_SUPPORT = 10


def parse_list(s):
    return ast.literal_eval(s) if isinstance(s, str) else []


def idf_matrix(lists_all, lists_keep):
    """IDF lissé calculé sur tout le dump, appliqué aux jeux retenus ; lignes normalisées L2."""
    docs = [set(l) for l in lists_all if l]
    n = pd.Series([x for d in docs for x in d]).value_counts()
    w = np.log((len(docs) + 1) / (n + 1)) + 1.0
    w[n < MIN_SUPPORT] = 0.0
    vocab = {t: j for j, t in enumerate(w.index)}
    rows, cols, vals = [], [], []
    for i, l in enumerate(lists_keep):
        for t in set(l):
            if t in vocab and w[t] > 0:
                rows.append(i); cols.append(vocab[t]); vals.append(w[t])
    X = sparse.csr_matrix((vals, (rows, cols)), shape=(len(lists_keep), len(vocab)))
    return normalize(X, norm="l2", axis=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--alphas", default="0,0.25,0.5,0.75,1",
                    help="valeurs de α séparées par des virgules ; une carte par valeur")
    ap.add_argument("--min-ratings", type=int, default=500)
    ap.add_argument("--method", default="auto", choices=["auto", "umap", "tsne"])
    a = ap.parse_args()
    alphas = [float(x) for x in a.alphas.split(",")]

    d = pd.read_csv(RAW / "details.csv")
    r = pd.read_csv(RAW / "ratings.csv")[["id", "users_rated"]]
    d = d.merge(r, on="id", how="left")
    d["m"] = d["boardgamemechanic"].map(parse_list)
    d["c"] = d["boardgamecategory"].map(parse_list)
    keep = d[(d["users_rated"].fillna(0) >= a.min_ratings) & ((d["m"].map(len) > 0) | (d["c"].map(len) > 0))]
    keep = keep.reset_index(drop=True)
    Xm, Xc = idf_matrix(d["m"], keep["m"]), idf_matrix(d["c"], keep["c"])

    method = a.method
    if method == "auto":
        try:
            import umap  # noqa: F401
            method = "umap"
        except ImportError:
            method = "tsne"

    maps = {}
    for al in alphas:
        Z = sparse.hstack([np.sqrt(al) * Xm, np.sqrt(1 - al) * Xc]).tocsr()
        if method == "umap":
            import umap
            Y = umap.UMAP(n_neighbors=15, min_dist=0.1, metric="cosine", random_state=0).fit_transform(Z)
        else:
            from sklearn.manifold import TSNE
            # Un jeu sans étiquette du bloc retenu (α = 0 ou 1) a un vecteur nul : distance cosinus 1 à tous.
            Y = TSNE(n_components=2, metric="cosine", perplexity=30, init="random", learning_rate="auto",
                     square_distances=True, random_state=0).fit_transform(Z.toarray())
        Y = Y - np.median(Y, axis=0)
        maps[al] = Y / np.percentile(np.abs(Y), 99.5)  # robuste aux points isolés
        print(f"  α = {al} : carte calculée")

    # Alignement de Procrustes (rotation/réflexion orthogonale) de chaque carte sur la plus proche de α = 0,5 :
    # l'orientation de t-SNE est arbitraire ; sans alignement, la transition animée entre deux cartes tournoierait.
    ref = maps[min(alphas, key=lambda x: abs(x - 0.5))]
    cols = {"id": keep["id"]}
    for j, al in enumerate(alphas):
        R, _ = orthogonal_procrustes(maps[al], ref)
        Y = maps[al] @ R
        cols[f"x{j}"], cols[f"y{j}"] = Y[:, 0].round(4), Y[:, 1].round(4)
    out = pd.DataFrame(cols)
    OUT.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT / "map_xy.csv", index=False)
    (OUT / "map_xy.method").write_text(f"{method}\n{','.join(str(x) for x in alphas)}\n")
    print(f"{len(out)} jeux, méthode {method}, α = {alphas} -> {OUT / 'map_xy.csv'}")


if __name__ == "__main__":
    main()
