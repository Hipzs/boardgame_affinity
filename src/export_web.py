"""Exporte les attributs de chaque jeu pour l'interface web, qui calcule la similarité dans le navigateur.

La similarité n'est pas précalculée : avec les filtres, les plus proches voisins doivent être cherchés
parmi les seuls jeux retenus, et les poids des attributs sont réglables.

Sortie : web/data/games.js, qui définit `window.BGG_DATA = {...}`. C'est un script et non un .json :
un fichier .json lu par fetch() ne charge pas depuis file://.
  meta : paramètres, source, date
  dict : {mech, cat, fam, des, art, pub} = listes de libellés (les nœuds stockent des indices)
  idf  : {mech, cat} = IDF lissé sur tout le dump (n_m < MIN_SUPPORT -> 0)
  words : vocabulaire des descriptions ; nodes[].dv : 40 mots les plus caractéristiques [[indice, poids], ...]
          (TF-IDF, titre du jeu retiré, renormalisé L2) ; nodes[].ri : groupe de réimplémentations (-1 si aucun)
  nodes[].x : extensions officielles BGG du jeu (indices dans dict.exp, extensions de fans exclues) ;
          nodes[].xl : groupe de gamme compatible (jeux partageant une extension, voir expansion_lines ; -1 si seul)
  nodes[].ow, tr, wa, wi : nombres de joueurs BGG qui possèdent / échangent / recherchent / souhaitent le jeu
  npmi : {mech, cat} = lignes creuses de S = max(0, NPMI) entre étiquettes (cosinus souple)
  nodes: [{id, n, y, b, av, r, p:[min,max], t, a, w, m, c, f, d, ar, pu}]
         b : note bayésienne (Geek Rating), av : note moyenne des joueurs
         ds : début de la description (≤ 240 car.), xy : [[x, y] par carte de meta.map_keys] ou null
         t : durée (min), a : âge min., w : poids 1-5 ou null ; 0 ou null = inconnu

Poids (complexité) : absent du dump TidyTuesday. Si data/raw/weights.csv existe (colonnes id, weight),
il est fusionné ; sinon w = null et le filtre de poids est désactivé dans l'interface.

Usage : python3 src/export_web.py [--min-ratings 500]
"""
import argparse
import ast
import datetime as dt
import html
import re
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, WEB = ROOT / "data" / "raw", ROOT / "web" / "data"
PROC = ROOT / "data" / "processed"
EXCERPT_CHARS = 240
MIN_PAIR = 5
DESC_TERMS = 40
FAM_SKIP = re.compile(r"^(Admin|Crowdfunding|Digital Implementations|Game|Versions & Editions|Misc):")
MIN_SUPPORT = 10
LISTS = {"m": ("boardgamemechanic", "mech"), "c": ("boardgamecategory", "cat"), "f": ("boardgamefamily", "fam"),
         "d": ("boardgamedesigner", "des"), "ar": ("boardgameartist", "art"), "pu": ("boardgamepublisher", "pub")}
UNCREDITED = "(Uncredited)"


def parse_list(s):
    """Les colonnes BGG sont des listes Python sérialisées en texte ("['A', 'B']")."""
    return ast.literal_eval(s) if isinstance(s, str) else []


def smoothed_idf(lists):
    """IDF lissé w = log((N+1)/(n+1)) + 1 sur les jeux qui ont au moins une étiquette ; supports < MIN_SUPPORT -> 0."""
    lists = [l for l in lists if l]
    N = len(lists)
    n = pd.Series([x for l in lists for x in set(l)]).value_counts()
    w = np.log((N + 1) / (n + 1)) + 1.0
    w[n < MIN_SUPPORT] = 0.0
    return w.to_dict()


def npmi_rows(lists, vocab, min_pair=MIN_PAIR):
    """Ressemblance entre étiquettes, pour le cosinus souple : S[t][t'] = max(0, NPMI(t, t')).

    NPMI(t, t') = log(P(t,t') / (P(t)P(t'))) / (−log P(t,t'))  ∈ [−1, 1], calculé sur tout le dump
    (jeux ayant au moins une étiquette du bloc). Paires vues moins de `min_pair` fois : ignorées (bruit).
    Sortie : rows[t] = [[t', S], ...] pour t' ≠ t (la diagonale S[t][t] = 1 est implicite côté JS).
    """
    idx = {x: i for i, x in enumerate(vocab)}
    docs = [sorted({idx[x] for x in l if x in idx}) for l in lists if l]
    N = len(docs)
    n = np.zeros(len(vocab))
    C = np.zeros((len(vocab), len(vocab)))
    for dset in docs:
        n[dset] += 1
        for a_ in range(len(dset)):
            for b_ in range(a_ + 1, len(dset)):
                C[dset[a_], dset[b_]] += 1
    C = C + C.T
    rows = [[] for _ in vocab]
    for t, u in zip(*np.nonzero(C >= min_pair)):
        p_tu, p_t, p_u = C[t, u] / N, n[t] / N, n[u] / N
        v = np.log(p_tu / (p_t * p_u)) / -np.log(p_tu)
        if v > 0:
            rows[t].append([int(u), round(float(v), 3)])
    return rows


def clean_text(text):
    """Description BGG en texte brut : entités HTML (parfois doublement échappées) décodées, espaces normalisés."""
    if not isinstance(text, str):
        return ""
    return re.sub(r"\s+", " ", html.unescape(html.unescape(text))).strip()


def description_vectors(texts, titles, k=DESC_TERMS):
    """Vecteur TF-IDF tronqué de chaque description : ses k mots les plus caractéristiques.

    Les mots du titre du jeu sont retirés de sa propre description (sinon « pandemic », « carcassonne »
    dominent et la métrique ne retrouve que la franchise). TfidfVectorizer : unigrammes, mots vides anglais,
    min_df = 3, max_df = 0,5, tf sous-linéaire. Le vecteur tronqué est renormalisé (L2).
    Renvoie (vocabulaire utilisé, [[[indice_mot, poids], ...] par jeu]).
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    cleaned = []
    for t, title in zip(texts, titles):
        words = {w for w in re.findall(r"[a-z]{3,}", title.lower())}
        if words:
            t = re.sub(r"\b(" + "|".join(sorted(words)) + r")\b", " ", t, flags=re.IGNORECASE)
        cleaned.append(t)
    vec = TfidfVectorizer(stop_words="english", min_df=3, max_df=0.5, sublinear_tf=True,
                          token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b")
    X = vec.fit_transform(cleaned).tocsr()
    names = vec.get_feature_names_out()
    used, rows = {}, []
    for i in range(X.shape[0]):
        lo, hi = X.indptr[i], X.indptr[i + 1]
        idx, val = X.indices[lo:hi], X.data[lo:hi]
        top = np.argsort(-val)[:k]
        norm = float(np.sqrt((val[top] ** 2).sum())) or 1.0
        row = []
        for j in top:
            w = names[idx[j]]
            if w not in used:
                used[w] = len(used)
            row.append([used[w], round(float(val[j]) / norm, 3)])
        rows.append(row)
    return list(used), rows


def implementation_groups(g, d):
    """Groupes de réimplémentations : composantes connexes du graphe (non orienté) des liens
    `boardgameimplementation`, restreint aux jeux exportés. Les liens sont des noms : un nom porté par
    plusieurs jeux relie tous ces jeux (ambiguïté rare). Renvoie un numéro de groupe par jeu (-1 si seul)."""
    by_name = {}
    for i, n in enumerate(g["primary"]):
        by_name.setdefault(n, []).append(i)
    parent = list(range(len(g)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for i, links in enumerate(g["boardgameimplementation"].map(parse_list)):
        for name in links:
            for j in by_name.get(name, []):
                parent[find(i)] = find(j)
    roots = [find(i) for i in range(len(g))]
    size = pd.Series(roots).value_counts()
    ids = {r: k for k, r in enumerate(size[size > 1].index)}
    return [ids.get(r, -1) for r in roots]


def official_expansions(lists):
    """Extensions listées par BGG pour chaque jeu, sans les extensions de fans (« … (fan expansion for …) »)."""
    return [[x for x in l if "fan expansion" not in x.lower()] for l in lists]


def title_root(name):
    """Racine d'un titre : texte avant « : », « ( », « – » ou « - » (ex. « Dominion: Intrigue » -> « dominion »)."""
    return re.split(r"[:(–—]| - ", name)[0].strip().lower()


def expansion_lines(names, exps):
    """Gammes compatibles : deux jeux sont reliés s'ils partagent une extension officielle dont le nom commence par
    la racine du titre de chacun (ex. Evolution et Evolution: Climate partagent « Evolution: Climate – … »).
    La condition de préfixe écarte les coffrets promo multi-jeux (« Brettspiel Adventskalender 2015 »…).
    Le dump ne contient pas les extensions elles-mêmes (seulement les jeux de base) : c'est la seule trace utilisable.
    Renvoie un numéro de groupe par jeu (composantes connexes ; -1 si seul)."""
    inv = {}
    for i, l in enumerate(exps):
        for x in l:
            inv.setdefault(x, []).append(i)
    roots = [title_root(n) for n in names]
    parent = list(range(len(names)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for x, games in inv.items():
        rx = x.lower()
        ok = [i for i in games if len(roots[i]) >= 3 and rx.startswith(roots[i])]
        for i in ok[1:]:
            parent[find(i)] = find(ok[0])
    comp = [find(i) for i in range(len(names))]
    size = pd.Series(comp).value_counts()
    ids = {r: k for k, r in enumerate(size[size > 1].index)}
    return [ids.get(r, -1) for r in comp]


def excerpt(text, n=EXCERPT_CHARS):
    """Début de la description BGG : entités HTML décodées, espaces normalisés, coupé à une fin de phrase
    (ou à un mot) avant n caractères."""
    if not isinstance(text, str):
        return ""
    t = clean_text(text)
    if len(t) <= n:
        return t
    cut = t[:n]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return cut[: end + 1] if end > n * 0.5 else cut[: cut.rfind(" ")] + " …"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-ratings", type=int, default=500)
    a = ap.parse_args()

    d = pd.read_csv(RAW / "details.csv")
    r = pd.read_csv(RAW / "ratings.csv")[["id", "average", "bayes_average", "users_rated"]]
    d = d.merge(r, on="id", how="left")
    for k, (col, _) in LISTS.items():
        d[k] = d[col].map(parse_list)
    for k in ("d", "ar"):
        d[k] = d[k].map(lambda l: [x for x in l if x != UNCREDITED])

    idf = {"mech": smoothed_idf(d["m"]), "cat": smoothed_idf(d["c"])}  # IDF sur tout le dump (~21k jeux)

    wpath = RAW / "weights.csv"
    weights = pd.read_csv(wpath).set_index("id")["weight"].to_dict() if wpath.exists() else {}

    g = d[(d["users_rated"].fillna(0) >= a.min_ratings) & ((d["m"].map(len) > 0) | (d["c"].map(len) > 0))]
    g = g.sort_values("users_rated", ascending=False).reset_index(drop=True)

    dicts, index = {}, {}
    for k, (_, name) in LISTS.items():
        vocab = sorted({x for l in g[k] for x in l})
        dicts[name], index[k] = vocab, {x: i for i, x in enumerate(vocab)}

    def num(x):
        return int(x) if x == x and x > 0 else 0  # NaN ou 0 -> 0 (inconnu)

    # Carte 2D (src/build_map.py), facultative.
    # Une carte par attribut seul : xy = [[x, y] pour chaque carte] ; meta.map_keys donne l'ordre (ex. m, c, f, d).
    mpath = PROC / "map_xy.csv"
    xy, map_method, map_keys = {}, None, []
    if mpath.exists():
        mdf = pd.read_csv(mpath).set_index("id")
        meth_lines = (PROC / "map_xy.method").read_text().split("\n")
        map_method, map_keys = meth_lines[0].strip(), meth_lines[1].strip().split(",")
        for gid, row in mdf.iterrows():
            xy[gid] = [[row[f"x{j}"], row[f"y{j}"]] for j in range(len(map_keys))]

    words, desc_vec = description_vectors(g["description"].map(clean_text).tolist(), g["primary"].tolist())
    groups = implementation_groups(g, d)
    exps = official_expansions(g["boardgameexpansion"].map(parse_list))
    lines = expansion_lines(g["primary"].tolist(), exps)
    dicts["exp"] = sorted({x for l in exps for x in l})
    exp_index = {x: i for i, x in enumerate(dicts["exp"])}

    nodes = []
    for row, dv, ri, ex, xl in zip(g.itertuples(index=False), desc_vec, groups, exps, lines):
        w = weights.get(row.id)
        pt = xy.get(row.id)
        node = {"id": int(row.id), "n": row.primary, "y": num(row.yearpublished) or None,
                "b": round(float(row.bayes_average), 3), "av": round(float(row.average), 2), "r": int(row.users_rated),
                "p": [num(row.minplayers), num(row.maxplayers)], "t": num(row.playingtime), "a": num(row.minage),
                "w": round(float(w), 2) if w is not None and w == w and w > 0 else None,
                "ds": excerpt(row.description),
                "dv": dv, "ri": ri, "x": [exp_index[x] for x in ex], "xl": xl,
                # comportement des joueurs (collections BGG) : possédé, à échanger, recherché, liste de souhaits
                "ow": num(row.owned), "tr": num(row.trading), "wa": num(row.wanting), "wi": num(row.wishing),
                "xy": pt}
        for k in LISTS:
            node[k] = [index[k][x] for x in getattr(row, k)]
        nodes.append(node)

    data = {
        "meta": {"min_ratings": a.min_ratings, "min_support": MIN_SUPPORT, "has_weight": bool(weights),
                 "map_method": map_method, "map_keys": map_keys,
                 "source": "BGG via TidyTuesday 2022-01-25", "generated": dt.date.today().isoformat()},
        "dict": dicts,
        "idf": {"mech": [round(idf["mech"].get(x, 0.0), 4) for x in dicts["mech"]],
                "cat": [round(idf["cat"].get(x, 0.0), 4) for x in dicts["cat"]]},
        "words": words,
        "npmi": {"mech": npmi_rows(d["m"], dicts["mech"]), "cat": npmi_rows(d["c"], dicts["cat"]),
                 "fam": npmi_rows(d["f"].map(lambda l: [x for x in l if not FAM_SKIP.match(x)]), dicts["fam"])},
        "nodes": nodes,
    }
    WEB.mkdir(parents=True, exist_ok=True)
    out = WEB / "games.js"
    out.write_text("window.BGG_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print(f"{len(nodes)} jeux (>= {a.min_ratings} avis) ; mécaniques {len(dicts['mech'])}, catégories "
          f"{len(dicts['cat'])}, familles {len(dicts['fam'])}, auteurs {len(dicts['des'])}, illustrateurs "
          f"{len(dicts['art'])}, éditeurs {len(dicts['pub'])} ; poids : {'oui' if weights else 'absent'} "
          f"-> {out} ({out.stat().st_size / 1e6:.2f} Mo)")


if __name__ == "__main__":
    main()
