import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { devMailPlugin } from "./dev-mail";

export default defineConfig({
  plugins: [devMailPlugin(), react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4000",
      "/health": "http://127.0.0.1:4000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
