"""Construit la matrice binaire jeux x mécaniques à partir du dump BGG (TidyTuesday 2022-01-25).

Entrées : data/raw/details.csv, data/raw/ratings.csv
Sorties (data/processed/) :
  - games.csv              : une ligne par jeu (index de ligne de X), méta-données utiles
  - mechanics.csv          : une ligne par mécanique (index de colonne de X), fréquence n_m, IDF
  - X_mechanics.npz        : X ∈ {0,1}^{N×M}, scipy.sparse CSR
"""
import ast
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "processed"


def parse_list(s):
    """Les colonnes BGG sont des listes Python sérialisées en texte ("['A', 'B']")."""
    return ast.literal_eval(s) if isinstance(s, str) else []


def main():
    d = pd.read_csv(RAW / "details.csv")
    r = pd.read_csv(RAW / "ratings.csv")[["id", "rank", "average", "bayes_average", "users_rated"]]
    d["mechanics"] = d["boardgamemechanic"].map(parse_list)
    d["categories"] = d["boardgamecategory"].map(parse_list)

    # On garde les jeux qui ont au moins une mécanique (les autres n'ont pas de vecteur).
    g = d[d["mechanics"].map(len) > 0].merge(r, on="id", how="left").reset_index(drop=True)

    mechs = sorted({m for ms in g["mechanics"] for m in ms})
    col = {m: j for j, m in enumerate(mechs)}
    rows = np.repeat(np.arange(len(g)), g["mechanics"].map(len))
    cols = [col[m] for ms in g["mechanics"] for m in ms]
    X = sparse.csr_matrix((np.ones(len(cols), dtype=np.int8), (rows, cols)), shape=(len(g), len(mechs)))
    X.data[:] = 1  # sécurité si une mécanique était listée deux fois

    N = X.shape[0]
    n_m = np.asarray(X.sum(axis=0)).ravel()
    m_df = pd.DataFrame({"mechanic": mechs, "n_games": n_m, "freq": n_m / N, "idf": np.log(N / n_m)})

    OUT.mkdir(parents=True, exist_ok=True)
    sparse.save_npz(OUT / "X_mechanics.npz", X)
    m_df.to_csv(OUT / "mechanics.csv", index=False)
    keep = ["id", "primary", "yearpublished", "minplayers", "maxplayers", "playingtime", "minage",
            "rank", "average", "bayes_average", "users_rated", "owned"]
    games = g[keep].rename(columns={"primary": "name"})
    games["categories"] = g["categories"].map("|".join)
    games["mechanics"] = g["mechanics"].map("|".join)
    games.to_csv(OUT / "games.csv", index=False)

    k = np.asarray(X.sum(axis=1)).ravel()
    print(f"jeux dans le dump : {len(d)} ; avec >= 1 mécanique : N = {N} ; mécaniques : M = {len(mechs)}")
    print(f"densité de X : {X.nnz / (N * len(mechs)):.4f} ; mécaniques par jeu : moyenne {k.mean():.2f}, "
          f"médiane {np.median(k):.0f}, max {k.max()}")
    print("\n10 mécaniques les plus fréquentes :")
    print(m_df.nlargest(10, "n_games").to_string(index=False, float_format="%.3f"))
    print("\n5 mécaniques les plus rares :")
    print(m_df.nsmallest(5, "n_games").to_string(index=False, float_format="%.3f"))


if __name__ == "__main__":
    main()
