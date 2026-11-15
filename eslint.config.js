// Configuration ESLint (flat config). Erreurs courantes seulement : le style est l'affaire de Prettier.
// Règle d'architecture : web/lib/ est de la logique pure, sans DOM ni stockage (voir web/ARCHITECTURE.md).
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "web/data/**",
      "playwright-report/**",
      "test-results/**",
      // Fichiers hérités, en cours de découpage (étapes 1 à 7) : non lintés jusqu'à leur suppression.
      "web/collections.js",
      "web/collection-store.js",
      "web/emoji.js",
      "web/default-collections.js",
      "tests/fixtures/games.small.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["web/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
  },
  {
    // d3 est un global (CDN) : autorisé seulement dans les vues et composants.
    files: ["web/pages/**/*.js", "web/ui/**/*.js"],
    languageOptions: { globals: { d3: "readonly" } },
  },
  {
    // Logique pure : aucun accès au navigateur. Toute dépendance (storage, horloge…) est injectée.
    files: ["web/lib/**/*.js"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "document", message: "web/lib est sans DOM : passer l'élément ou déplacer le code dans web/ui." },
        { name: "window", message: "web/lib est sans DOM : injecter la dépendance." },
        { name: "localStorage", message: "web/lib : injecter le stockage (voir createCollectionStore)." },
        { name: "d3", message: "web/lib n'utilise pas d3." },
      ],
    },
  },
  {
    files: ["tests/**/*.js", "tests/**/*.mjs", "eslint.config.js", "playwright.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
  },
  {
    // Tests de bout en bout : les fonctions passées à page.evaluate / addInitScript s'exécutent dans la page.
    files: ["tests/e2e/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
];
