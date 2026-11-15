// Types partagés. Usage dans un module : un commentaire JSDoc avec @import { Game } from "../types". Données : src/export_web.py.

export type AttrKey = "m" | "c" | "f" | "d";
export type TagKey = "f" | "d" | "ar" | "pu";
export type MetricKey = "cos" | "jac" | "ovl" | "soft";

/** Un jeu ; les listes d'étiquettes sont des indices dans les dictionnaires de RawData.dict. */
export interface Game {
  id: number;
  n: string;
  y: number | null;
  b: number; // note bayésienne
  av: number; // note moyenne
  r: number; // nombre d'avis
  p: [number, number]; // joueurs min, max
  t: number; // durée
  a: number; // âge
  w: number | null; // poids
  ds?: string;
  dv: [number, number][]; // mots-clés TF-IDF : [indice de mot, poids]
  ri: number; // groupe de réimplémentation (-1 : aucun)
  x: number[]; // extensions
  xl: number; // gamme d'extensions (-1 : aucune)
  ow: number;
  tr: number;
  wa?: number;
  wi: number;
  m: number[];
  c: number[];
  f: number[];
  d: number[];
  ar: number[];
  pu: number[];
  xy?: [number, number][]; // une position par carte
}

export interface RawData {
  meta: Record<string, any>;
  dict: Record<"mech" | "cat" | "fam" | "des" | "art" | "pub" | "exp", string[]>;
  idf: { mech: number[]; cat: number[] };
  words: string[];
  npmi: { mech: [number, number][][]; cat: [number, number][][]; fam: [number, number][][] };
  nodes: Game[];
}

/** [indice du jeu, similarité, (score pépite)] */
export type Neighbor = [number, number, number?];

export interface Expansion {
  level: Map<number, number>;
  parent: Map<number, [number, number]>;
  links: { source: number; target: number; s: number; cross: boolean }[];
  truncated: boolean;
  pruned: number;
}

export interface Collection {
  cid: string;
  name: string;
  color: string;
  created: string;
  games: number[];
}
export interface CollectionsData {
  games: { id: number; added: string }[];
  collections: Collection[];
}

export type Mode = "and" | "or";
/** État des filtres partagé par les deux pages (voir web/lib/filters.js). */
export interface FilterState {
  reqKeys: string[];
  kw: string[];
  kwText: string;
  nums: Record<string, number | null>;
  rate: Record<string, { min: number; max: number; lo: number; hi: number }>;
  req: Record<string, Set<number>>;
  ban: Record<string, Set<number>>;
  modeReq: Record<string, Mode>;
  tags: Record<string, Set<number>>;
  notTags: Record<string, Set<number>>;
  modeTag: Record<string, Mode>;
  noFranchise: boolean;
  noReimpl: boolean;
  noExpLine: boolean;
  sigFilter: boolean;
}

/** Un attribut (mécaniques, thème, familles, description) : étiquettes de chaque jeu, poids et index, construits par buildAttrs. */
export interface Attr {
  label: string;
  short: string;
  dict: string[];
  terms: (g: Game) => number[];
  idf: ArrayLike<number>;
  npmi: [number, number][][] | null;
  weights?: (g: Game) => [number, number][];
  vec: Map<number, number>[];
  set: Set<number>[];
  post: number[][];
  sTimes?: (x: Map<number, number>) => Float64Array;
  snorm?: number[];
}
export type Attrs = Record<string, Attr>;
export interface MetricInfo {
  label: string;
  short: string;
  help: string;
}
