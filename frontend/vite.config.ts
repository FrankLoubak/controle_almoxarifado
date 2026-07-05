/**
 * Finalidade: configuração do Vite para o frontend React + TypeScript.
 * Como funciona: habilita o plugin React e um proxy de /api para o backend em dev.
 * Relações: consome VITE_API_URL (.env); as telas em src/ chamam a API via /api.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
