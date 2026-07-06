/**
 * Finalidade: rate limiting para login e envio de OTP (proteção contra brute force/flood).
 * Como funciona: fábrica sobre express-rate-limit; janelas/limites vêm de config, com
 *   override opcional (usado nos testes). Store em memória — dívida técnica documentada
 *   para ambiente multi-instância (migrar para Redis).
 * Relações: consumido pelo app factory nas rotas de auth.
 */
import rateLimit from "express-rate-limit";
import { config } from "../../config/env";

export interface RateLimitOverrides {
  loginMax?: number;
  otpMax?: number;
  globalMax?: number;
  windowMs?: number;
}

export function makeLoginLimiter(o: RateLimitOverrides = {}) {
  return rateLimit({
    windowMs: o.windowMs ?? config.rateLimit.loginWindowMs,
    max: o.loginMax ?? config.rateLimit.loginMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "muitas tentativas de login, tente mais tarde" },
  });
}

export function makeOtpLimiter(o: RateLimitOverrides = {}) {
  return rateLimit({
    windowMs: o.windowMs ?? config.rateLimit.otpWindowMs,
    max: o.otpMax ?? config.rateLimit.otpMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: "muitas requisições de código, tente mais tarde" },
  });
}
