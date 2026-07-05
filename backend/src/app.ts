/**
 * Finalidade: montagem da aplicação Express (factory), reutilizável em dev e nos testes.
 * Como funciona: registra JSON, cookies, healthcheck, as rotas de auth (funcionário e
 *   super-admin) e o middleware de erros. Aceita overrides de rate limit (usado em teste).
 * Relações: consumido por index.ts (servidor) e pelos testes (supertest).
 */
import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler } from "./http/middleware/errors";
import type { RateLimitOverrides } from "./http/middleware/rateLimit";
import { authRouter } from "./http/routes/auth";
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

  app.use(errorHandler);
  return app;
}
