/**
 * Finalidade: bootstrap do app React (router + provider de autenticação + estilos).
 * Como funciona: monta App dentro de BrowserRouter e AuthProvider na div #root.
 * Relações: App.tsx (rotas), AuthContext (sessão), styles.css.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
