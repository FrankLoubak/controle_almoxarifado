/**
 * Finalidade: montagem da aplicação Express (factory), reutilizável em dev e nos testes.
 * Como funciona: registra JSON, cookies, healthcheck, as rotas de auth (funcionário e
 *   super-admin) e o middleware de erros. Aceita overrides de rate limit (usado em teste).
 * Relações: consumido por index.ts (servidor) e pelos testes (supertest).
 */
import cookieParser from "cookie-parser";
import express from "express";
import { authenticate } from "./http/middleware/authenticate";
import { errorHandler } from "./http/middleware/errors";
import type { RateLimitOverrides } from "./http/middleware/rateLimit";
import { authRouter } from "./http/routes/auth";
import { emprestimosRouter } from "./http/routes/emprestimos";
import { ferramentasRouter } from "./http/routes/ferramentas";
import { funcionariosRouter } from "./http/routes/funcionarios";
import { orcamentosRouter } from "./http/routes/orcamentos";
import { prestadoresRouter } from "./http/routes/prestadores";
import { relatoriosRouter } from "./http/routes/relatorios";
import { reparosRouter } from "./http/routes/reparos";
import { superAdminAuthRouter } from "./http/routes/superAdminAuth";

export function createApp(opts: { rateLimit?: RateLimitOverrides } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "almoxarifado-backend" });
  });

  app.use("/auth/super-admin", superAdminAuthRouter(opts.rateLimit));
  app.use("/auth", authRouter(opts.rateLimit));

  // Rotas de negócio (Sprint 3+) — exigem funcionário autenticado.
  app.use("/funcionarios", authenticate, funcionariosRouter());
  app.use("/prestadores", authenticate, prestadoresRouter());
  app.use("/ferramentas", authenticate, ferramentasRouter());
  app.use("/emprestimos", authenticate, emprestimosRouter());
  app.use("/orcamentos", authenticate, orcamentosRouter());
  app.use("/reparos", authenticate, reparosRouter());
  app.use("/relatorios", authenticate, relatoriosRouter());

  app.use(errorHandler);
  return app;
}
