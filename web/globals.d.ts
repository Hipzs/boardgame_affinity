// Globales fournies par les pages : d3 (CDN) et les données (web/data/games.js).
import type { RawData } from "./types";

declare global {
  const d3: any; // chargé par CDN ; non typé (les génériques de d3 alourdissent plus qu'ils ne protègent ici)
  interface Window {
    BGG_DATA: RawData;
    d3: any;
  }
}
export {};
