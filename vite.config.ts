import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"] },
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "./",
        // The UI is bilingual; the home-screen name is in French, the user's language.
        name: "Mes remboursements",
        short_name: "Remboursements",
        description: "Suivi des dépenses en attente de remboursement / Track expenses awaiting a refund.",
        lang: "fr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f3f5f6",
        theme_color: "#0e5a63",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Run under a zone far from Paris so any reliance on the machine zone shows up.
    env: { TZ: "Pacific/Auckland" },
  },
});
