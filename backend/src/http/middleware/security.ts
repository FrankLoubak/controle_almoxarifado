/**
 * Finalidade: hardening HTTP (cabeçalhos de segurança, rate limit global, auditoria).
 * Como funciona: helmet aplica cabeçalhos seguros; um limiter global protege contra flood;
 *   auditLogger registra (estruturado) as requisições mutantes com usuário/tenant/status —
 *   em produção esses logs vão para um agregador.
 * Relações: usado por app.ts. Complementa os rate limits específicos de login/OTP.
 */
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "../../config/env";

// Cabeçalhos de segurança. A API responde JSON; CSP fica a cargo do frontend/servidor web.
export const securityHeaders = helmet({ contentSecurityPolicy: false });

export function makeGlobalLimiter(max = config.rateLimit.globalMax) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "muitas requisições, tente mais tarde" },
  });
}

// Auditoria de acesso: registra requisições que alteram estado (não-GET) com contexto.
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "OPTIONS") return next();
  res.on("finish", () => {
    const registro = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      sub: req.auth?.sub ?? null,
      tenant: req.auth?.tenantId ?? null,
      ip: req.ip,
    };
    // eslint-disable-next-line no-console
    console.info(`[audit] ${JSON.stringify(registro)}`);
  });
  next();
}
