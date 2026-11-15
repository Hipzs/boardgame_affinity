"""Compare deux cartes 2D (ex. t-SNE et UMAP) sur trois critères, par attribut. Aucune écriture dans data/processed
sauf map_comparison.json.

  trust@k  : trustworthiness (sklearn) = les voisins dans la carte sont de vrais voisins (structure locale, 0–1)
  recall@k : part des k plus proches voisins réels (distance cosinus) retrouvés parmi les k plus proches voisins 2D
  spearman : corrélation de rang entre distances réelles et distances 2D sur des paires tirées au hasard
             (structure globale : les grappes éloignées le sont-elles aussi sur la carte ?)
Seuls les jeux ayant au moins une étiquette de l'attribut sont comparés (les autres sont à distance 1 de tous).

Usage : python3 src/compare_maps.py DOSSIER_A DOSSIER_B [--k 15]
        (chaque dossier contient map_xy.csv et map_xy.method, produits par src/build_map.py)
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.manifold import trustworthiness
from sklearn.neighbors import NearestNeighbors

import build_map

ROOT = Path(__file__).resolve().parents[1]


def load_map(folder):
    df = pd.read_csv(folder / "map_xy.csv")
    method, keys = (folder / "map_xy.method").read_text().split("\n")[:2]
    return df, method.strip(), keys.strip().split(",")


def knn_ids(D, k):
    """Indices des k plus proches voisins de chaque ligne d'une matrice de distances (sans le point lui-même)."""
    return np.argpartition(D + np.diag(np.full(len(D), np.inf)), k, axis=1)[:, :k]


def recall_at_k(Dtrue, Y, k):
    true = knn_ids(Dtrue, k)
    nn = NearestNeighbors(n_neighbors=k + 1).fit(Y)
    emb = nn.kneighbors(Y, return_distance=False)[:, 1:]
    return float(np.mean([len(set(t) & set(e)) / k for t, e in zip(true, emb)]))


def global_spearman(Dtrue, Y, n_pairs=200_000, seed=0):
    rng = np.random.default_rng(seed)
    i = rng.integers(0, len(Y), n_pairs)
    j = rng.integers(0, len(Y), n_pairs)
    ok = i != j
    i, j = i[ok], j[ok]
    return float(spearmanr(Dtrue[i, j], np.linalg.norm(Y[i] - Y[j], axis=1)).correlation)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("a", type=Path)
    ap.add_argument("b", type=Path)
    ap.add_argument("--k", type=int, default=15)
    ap.add_argument("--min-ratings", type=int, default=500)
    a = ap.parse_args()
    keep, build = build_map.load_games(a.min_ratings)
    maps = [load_map(p) for p in (a.a, a.b)]
    for df, _, _ in maps:
        assert (df["id"].values == keep["id"].values).all(), "cartes et jeux retenus incohérents (--min-ratings ?)"
    results = {}
    print(f"{'attribut':<16}{'méthode':<8}{'trust@%d' % a.k:>10}{'recall@%d' % a.k:>10}{'spearman':>10}")
    for j, key in enumerate(maps[0][2]):
        X = build[key]()
        has = np.asarray(X.getnnz(axis=1) > 0).ravel()
        Dm = build_map.cosine_distance(X)[np.ix_(has, has)]
        for df, method, keys in maps:
            c = keys.index(key)
            Y = df[[f"x{c}", f"y{c}"]].values[has]
            r = {
                "trust": float(trustworthiness(Dm, Y, n_neighbors=a.k, metric="precomputed")),
                "recall": recall_at_k(Dm, Y, a.k),
                "spearman": global_spearman(Dm, Y),
            }
            results.setdefault(key, {})[method] = r
            print(f"{build_map.ATTR_NAMES[key]:<16}{method:<8}{r['trust']:>10.3f}{r['recall']:>10.3f}{r['spearman']:>10.3f}")
    out = ROOT / "data" / "processed" / "map_comparison.json"
    out.write_text(json.dumps(results, indent=1, ensure_ascii=False))
    print(f"-> {out}")


if __name__ == "__main__":
    main()
