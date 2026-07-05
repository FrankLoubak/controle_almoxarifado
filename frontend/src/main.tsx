/**
 * Finalidade: bootstrap do app React (esqueleto Sprint 0).
 * Como funciona: monta o componente App na div #root do index.html.
 * Relações: App.tsx (raiz da UI); telas reais entram a partir do Sprint 7.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
