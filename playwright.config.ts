import { defineConfig, devices } from "@playwright/test";

/** Browser tests on the production build, phone (390 px) and desktop (1280 px). Run: npm run test:e2e */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:4175", trace: "off", locale: "en-US", timezoneId: "Europe/Paris" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], locale: "en-US" } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4175 --strictPort",
    url: "http://localhost:4175",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
