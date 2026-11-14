/* « Mes collections » : jeux ajoutés depuis l'explorateur et collections nommées, partagés entre l'explorateur
 * (index.html) et la page collections.html.
 *
 * Modèle (stockage, clé KEY) :
 *   games       : [{id, added}]  tous les jeux ajoutés (id = identifiant BGG, stable d'un export à l'autre)
 *   collections : [{cid, name, color, created, games: [id, …]}]  groupes définis par l'utilisateur
 *                 (color : "#rrggbb" ou "") ; un jeu peut être dans plusieurs collections
 *   « Nouveaux jeux » (panneau gauche) = jeux ajoutés qui ne sont dans aucune collection.
 * Propre à ce navigateur et à cette adresse : exporter en JSON pour sauvegarder.
 * Synchro entre onglets : événement « storage » (déclenché dans les AUTRES onglets), branché via addStorageListener.
 * Migration : l'ancienne clé bga.collection.v1 (liste [{id, added}]) devient la liste des jeux.
 *
 * Module pur : le stockage, les collections par défaut, l'horloge et le générateur d'identifiants sont injectés.
 */

export const KEY = "bga.collections.v2";
export const OLD_KEY = "bga.collection.v1";

/** Nettoie des données lues (stockage, import) : ne garde que ce qui a la forme attendue. */
export const clean = (d) => ({
  games: (Array.isArray(d && d.games) ? d.games : []).filter((x) => x && Number.isFinite(x.id)),
  collections: (Array.isArray(d && d.collections) ? d.collections : [])
    .filter((c) => c && c.cid && typeof c.name === "string")
    .map((c) => ({
      cid: c.cid,
      name: c.name,
      color: /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "",
      created: c.created || "",
      games: (c.games || []).filter(Number.isFinite),
    })),
});

/**
 * @param {object} [opts]
 * @param {Storage | null} [opts.storage]  localStorage ou équivalent (null/indisponible : repli mémoire)
 * @param {{games?: any[], collections?: any[]} | null} [opts.defaults]  collections proposées au tout premier chargement
 * @param {() => string} [opts.now]  horodatage ISO
 * @param {() => string} [opts.newCid]  identifiant de collection
 * @param {(onKeyChange: (key: string) => void) => void} [opts.addStorageListener]  appelle le callback à chaque modification venant d'un autre onglet
 */
export function createCollectionStore({
  storage = null,
  defaults = null,
  now = () => new Date().toISOString(),
  newCid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  addStorageListener = () => {},
} = {}) {
  let mem = { games: [], collections: [] }; // repli si le stockage est indisponible
  const listeners = [];

  function read() {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return clean(JSON.parse(raw));
      const old = storage.getItem(OLD_KEY); // migration v1
      if (old) {
        const d = clean({ games: JSON.parse(old), collections: [] });
        storage.setItem(KEY, JSON.stringify(d));
        storage.removeItem(OLD_KEY);
        return d;
      }
      // Tout premier chargement : collections par défaut (web/default-collections.js), enregistrées aussitôt
      // pour qu'une suppression par l'utilisateur soit définitive.
      const def = defaults;
      if (def && ((def.games || []).length || (def.collections || []).length)) {
        const now0 = now();
        const d = clean({
          games: (def.games || []).map((x) => (typeof x === "number" ? { id: x, added: now0 } : x)),
          collections: (def.collections || []).map((c, j) => ({
            cid: c.cid || `cdef${j}`,
            name: c.name,
            color: c.color || "",
            created: c.created || now0,
            games: c.games || [],
          })),
        });
        for (const c of d.collections)
          for (const id of c.games) if (!d.games.some((x) => x.id === id)) d.games.push({ id, added: now0 });
        storage.setItem(KEY, JSON.stringify(d));
        return d;
      }
      return clean(null);
    } catch {
      return clean(JSON.parse(JSON.stringify(mem)));
    }
  }
  function write(d) {
    mem = d;
    try {
      storage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* repli mémoire */
    }
    listeners.forEach((f) => f());
  }
  const edit = (f) => {
    const d = read();
    const r = f(d);
    write(d);
    return r;
  };
  addStorageListener((key) => {
    if (key === KEY) listeners.forEach((f) => f());
  });
  const ensureGame = (d, id) => {
    if (!d.games.some((x) => x.id === id)) d.games.push({ id, added: now() });
  };

  const api = {
    onChange(f) {
      listeners.push(f);
    },
    // --- jeux ---
    list: () => read().games,
    has: (id) => read().games.some((x) => x.id === id),
    add: (id) => edit((d) => ensureGame(d, id)),
    // Retire le jeu partout (liste des jeux et toutes les collections).
    remove: (id) =>
      edit((d) => {
        d.games = d.games.filter((x) => x.id !== id);
        d.collections.forEach((c) => {
          c.games = c.games.filter((g) => g !== id);
        });
      }),
    toggle(id) {
      if (api.has(id)) api.remove(id);
      else api.add(id);
    },
    // Nouveaux jeux : ajoutés mais dans aucune collection.
    inbox() {
      const d = read(),
        used = new Set(d.collections.flatMap((c) => c.games));
      return d.games.filter((x) => !used.has(x.id));
    },
    collectionsOf: (id) => read().collections.filter((c) => c.games.includes(id)),
    // --- collections ---
    collections: () => read().collections,
    createCollection: (name, color = "") =>
      edit((d) => {
        const cid = newCid();
        d.collections.push({ cid, name, color, created: now(), games: [] });
        return cid;
      }),
    renameCollection: (cid, name) =>
      edit((d) => {
        const c = d.collections.find((x) => x.cid === cid);
        if (c) c.name = name;
      }),
    // Modifie nom et / ou couleur ({name, color}) en une seule écriture.
    updateCollection: (cid, patch) =>
      edit((d) => {
        const c = d.collections.find((x) => x.cid === cid);
        if (!c) return;
        if (typeof patch.name === "string" && patch.name.trim()) c.name = patch.name.trim();
        if (typeof patch.color === "string") c.color = patch.color;
      }),
    // Déplace la collection cid juste avant beforeCid (null = à la fin) : ordre d'affichage.
    reorderCollection: (cid, beforeCid) =>
      edit((d) => {
        const i = d.collections.findIndex((x) => x.cid === cid);
        if (i < 0 || cid === beforeCid) return;
        const [c] = d.collections.splice(i, 1);
        const j = beforeCid ? d.collections.findIndex((x) => x.cid === beforeCid) : -1;
        if (j < 0) d.collections.push(c);
        else d.collections.splice(j, 0, c);
      }),
    // Supprime la collection ; ses jeux restent dans « Nouveaux jeux » s'ils ne sont dans aucune autre.
    deleteCollection: (cid) =>
      edit((d) => {
        d.collections = d.collections.filter((x) => x.cid !== cid);
      }),
    // Place le jeu dans la collection `to` (null = retour aux nouveaux jeux) ; `from` = collection d'origine
    // (null = nouveaux jeux) ; copy = vrai pour le laisser aussi dans `from`.
    move: (id, from, to, copy = false) =>
      edit((d) => {
        ensureGame(d, id);
        const F = d.collections.find((x) => x.cid === from),
          T = d.collections.find((x) => x.cid === to);
        if (T && !T.games.includes(id)) T.games.push(id);
        if (F && F !== T && !copy) F.games = F.games.filter((g) => g !== id);
      }),
    // Ajout groupé (une seule écriture) : ids ajoutés à mes jeux, et à la collection cid si elle est donnée.
    // Renvoie {added: nouveaux dans mes jeux, inColl: nouveaux dans la collection}.
    addMany: (ids, cid = null) =>
      edit((d) => {
        const T = cid ? d.collections.find((x) => x.cid === cid) : null;
        let added = 0,
          inColl = 0;
        for (const id of ids) {
          if (!d.games.some((x) => x.id === id)) {
            d.games.push({ id, added: now() });
            added++;
          }
          if (T && !T.games.includes(id)) {
            T.games.push(id);
            inColl++;
          }
        }
        return { added, inColl };
      }),
    // --- sauvegarde ---
    exportJSON: () => JSON.stringify({ version: 2, ...read() }, null, 1),
    // Import par fusion : jeux et collections ajoutés (collection de même nom : jeux réunis). Accepte aussi la v1.
    importJSON(text) {
      const raw = JSON.parse(text);
      const inc = clean(Array.isArray(raw) ? { games: raw } : raw);
      if (!inc.games.length && !inc.collections.length) throw new Error("aucun jeu ni collection trouvé");
      return edit((d) => {
        const n0 = d.games.length,
          c0 = d.collections.length;
        for (const g of inc.games)
          if (!d.games.some((x) => x.id === g.id)) d.games.push({ id: g.id, added: g.added || now() });
        for (const c of inc.collections) {
          let T = d.collections.find((x) => x.name === c.name);
          if (!T) {
            T = { cid: newCid(), name: c.name, color: c.color || "", created: c.created || now(), games: [] };
            d.collections.push(T);
          }
          for (const id of c.games) {
            ensureGame(d, id);
            if (!T.games.includes(id)) T.games.push(id);
          }
        }
        return { games: d.games.length - n0, collections: d.collections.length - c0 };
      });
    },
  };
  return api;
}
