// Tests de bout en bout (Playwright). Serveur : web/serve.py (sans cache), lancé automatiquement.
// Données : par défaut la fixture tests/fixtures/games.small.js est substituée à web/data/games.js (voir tests/e2e/helpers.js) ;
// E2E_REAL_DATA=1 joue sur les vraies données (web/data/games.js, 6 Mo, gitignoré) : baseline.spec.js l'exige.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  reporter: [["list"], ["html", { open: "never" }]],
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:8765",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    locale: "fr-FR",
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "python3 web/serve.py 8765",
    url: "http://127.0.0.1:8765/index.html",
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
