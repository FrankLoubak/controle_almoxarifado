/**
 * Finalidade: contexto de autenticação do frontend (login em 2 passos + sessão).
 * Como funciona: no mount tenta refresh silencioso (cookie); expõe login (telefone+senha
 *   → challengeId), verifyOtp (→ access token + claims via /auth/me), e logout. Guarda as
 *   claims (isRoot/isAlmoxarife) para a UI.
 * Relações: usa api/client; consumido por App, ProtectedRoute e páginas.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAccessToken } from "../api/client";

export interface Claims {
  sub: string;
  type: "funcionario" | "super_admin";
  tenantId?: string;
  isRoot?: boolean;
  isAlmoxarife?: boolean;
}

type Status = "loading" | "authed" | "anon";

interface AuthValue {
  status: Status;
  claims: Claims | null;
  login: (telefone: string, senha: string) => Promise<string>; // retorna challengeId
  verifyOtp: (challengeId: string, codigo: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [claims, setClaims] = useState<Claims | null>(null);

  async function loadClaims() {
    const { auth } = await api.get<{ auth: Claims }>("/auth/me");
    setClaims(auth);
    setStatus("authed");
  }

  useEffect(() => {
    (async () => {
      try {
        const { accessToken } = await api.post<{ accessToken: string }>("/auth/refresh");
        setAccessToken(accessToken);
        await loadClaims();
      } catch {
        setStatus("anon");
      }
    })();
  }, []);

  const value: AuthValue = {
    status,
    claims,
    async login(telefone, senha) {
      const { challengeId } = await api.post<{ challengeId: string }>("/auth/login", { telefone, senha });
      return challengeId;
    },
    async verifyOtp(challengeId, codigo) {
      const { accessToken } = await api.post<{ accessToken: string }>("/auth/verify-otp", { challengeId, codigo });
      setAccessToken(accessToken);
      await loadClaims();
    },
    async logout() {
      try {
        await api.post("/auth/logout");
      } finally {
        setAccessToken(null);
        setClaims(null);
        setStatus("anon");
      }
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
