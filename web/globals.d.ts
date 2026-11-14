// Globales fournies par les pages : d3 (CDN) et les données (web/data/games.js).
import type { RawData } from "./types";

declare global {
  interface Window {
    BGG_DATA: RawData;
    BGG_EMOJI: any;
    BGG_COLLECTION: any;
  }
}
export {};
