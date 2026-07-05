/**
 * Finalidade: configuração do Vite (React) e do Vitest (jsdom) do frontend.
 * Como funciona: habilita o plugin React; em dev, faz proxy de /api → backend removendo
 *   o prefixo /api; configura o Vitest com ambiente jsdom e setup de testing-library.
 * Relações: as telas em src/ chamam a API via apiClient (prefixo /api). Backend em 3000.
 */
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
