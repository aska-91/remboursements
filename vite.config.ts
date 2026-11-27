import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"] },
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Refund Tracker",
        short_name: "Refunds",
        description: "Keep track of expenses awaiting a refund.",
        lang: "en",
        start_url: ".",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1f6feb",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
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
