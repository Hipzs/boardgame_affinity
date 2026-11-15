// Globales fournies par les pages : d3 (CDN) et les données (web/data/games.js).
import type { RawData } from "./types";

declare global {
  const d3: any; // chargé par CDN ; non typé (les génériques de d3 alourdissent plus qu'ils ne protègent ici)
  interface Window {
    BGG_DATA: RawData;
    BGG_EMOJI: any;
    BGG_COLLECTION: any;
    d3: any;
    __dbg?: any; // temporaire (refactoring), retiré à l'étape 10
  }
}
export {};
