"""Similarité entre jeux à partir de la matrice binaire jeux x mécaniques X (voir build_matrix.py).

Trois mesures, de la plus simple à la plus riche :
  - jaccard : J(i,j) = |A_i ∩ A_j| / |A_i ∪ A_j|
  - idf     : cosinus sur x̃_im = X_im · w_m, avec IDF lissé w_m = log((N+1)/(n_m+1)) + 1,
              et mécaniques de support n_m < min_support ignorées (IDF non fiable)
  - svd     : cosinus dans l'espace latent de rang r de la SVD tronquée de X̃ (type LSA)

Usage :
  python3 src/similarity.py "Pandemic" [--method idf|jaccard|svd|all] [--k 10] [--min-ratings 500]
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

PROC = Path(__file__).resolve().parents[1] / "data" / "processed"


class GameSimilarity:
    def __init__(self, min_support=10, svd_rank=40, seed=0):
        self.games = pd.read_csv(PROC / "games.csv")
        self.mechs = pd.read_csv(PROC / "mechanics.csv")
        X = sparse.load_npz(PROC / "X_mechanics.npz").astype(np.float32).tocsr()
        N = X.shape[0]
        n_m = self.mechs["n_games"].to_numpy()

        self.X = X                                   # binaire, pour Jaccard
        self.k = np.asarray(X.sum(axis=1)).ravel()   # |A_i|

        w = np.log((N + 1) / (n_m + 1)) + 1.0        # IDF lissé
        w[n_m < min_support] = 0.0                    # supports trop faibles : ignorés
        self.w = w
        Xt = X @ sparse.diags(w.astype(np.float32))
        self.Xn = normalize(Xt, norm="l2", axis=1)    # lignes unitaires -> produit scalaire = cosinus

        self.svd = TruncatedSVD(n_components=svd_rank, random_state=seed)
        Z = self.svd.fit_transform(Xt)                # U_r Σ_r
        self.Zn = normalize(Z, norm="l2", axis=1)

    # --- recherche ---------------------------------------------------------
    def find(self, name):
        """Index du jeu : nom exact (insensible à la casse), sinon le plus noté parmi ceux qui contiennent `name`."""
        names = self.games["name"].str.lower()
        hit = self.games[names == name.lower()]
        if hit.empty:
            hit = self.games[names.str.contains(name.lower(), regex=False)]
        if hit.empty:
            raise KeyError(f"aucun jeu ne correspond à {name!r}")
        return hit["users_rated"].fillna(0).idxmax()

    def scores(self, i, method):
        if method == "jaccard":
            inter = (self.X @ self.X[i].T).toarray().ravel()
            union = self.k + self.k[i] - inter
            return np.divide(inter, union, out=np.zeros_like(inter), where=union > 0)
        if method == "idf":
            return (self.Xn @ self.Xn[i].T).toarray().ravel()
        if method == "svd":
            return self.Zn @ self.Zn[i]
        raise ValueError(method)

    def neighbors(self, name, method="idf", k=10, min_ratings=500):
        i = self.find(name)
        s = self.scores(i, method)
        g = self.games
        ok = (g["users_rated"].fillna(0) >= min_ratings).to_numpy()
        ok[i] = False
        # tri : score décroissant, puis note bayésienne décroissante pour départager les ex aequo
        order = np.lexsort((-g["bayes_average"].fillna(0).to_numpy(), -s))
        idx = [j for j in order if ok[j]][:k]
        qi = set(g.at[i, "mechanics"].split("|"))
        out = g.loc[idx, ["name", "yearpublished", "bayes_average"]].copy()
        out.insert(0, "score", s[idx])
        out["shared"] = [len(qi & set(g.at[j, "mechanics"].split("|"))) for j in idx]
        out["n_mech"] = [int(self.k[j]) for j in idx]
        return g.loc[i], out.reset_index(drop=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="+")
    ap.add_argument("--method", default="all", choices=["jaccard", "idf", "svd", "all"])
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--min-ratings", type=int, default=500)
    a = ap.parse_args()

    sim = GameSimilarity()
    ev = sim.svd.explained_variance_ratio_.sum()
    print(f"SVD rang {sim.svd.n_components} : {ev:.1%} de la variance de X̃ ; "
          f"mécaniques ignorées (n_m < 10) : {(sim.w == 0).sum()}\n")
    methods = ["jaccard", "idf", "svd"] if a.method == "all" else [a.method]
    for name in a.names:
        for m in methods:
            q, out = sim.neighbors(name, m, a.k, a.min_ratings)
            if m == methods[0]:
                print(f"=== {q['name']} ({q['yearpublished']}) : {q['mechanics'].replace('|', ', ')}")
            print(f"--- {m}")
            print(out.to_string(index=False, float_format="%.3f"))
        print()


if __name__ == "__main__":
    main()
