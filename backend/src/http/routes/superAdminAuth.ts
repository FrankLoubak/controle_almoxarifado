/**
 * Finalidade: rotas de autenticação do super-admin da plataforma (área separada, D16).
 * Como funciona: /login valida e-mail+senha e retorna um token de pré-autenticação curto;
 *   /verify-totp confere o código TOTP e emite a sessão (access + refresh). Sem contexto
 *   de tenant (super-admin é nível plataforma).
 * Relações: usa authRepo (lookup super-admin), auth/password, auth/totp, auth/tokens.
 */
import { Router, type Response } from "express";
import { z } from "zod";
import { lookupSuperAdminByEmail } from "../../auth/authRepo";
import { verifyPassword } from "../../auth/password";
import {
  issueRefreshToken,
  signAccessToken,
  signPreauthToken,
  verifyPreauthToken,
  type AccessClaims,
} from "../../auth/tokens";
import { verifyTotp } from "../../auth/totp";
import { config } from "../../config/env";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";
import { makeLoginLimiter, type RateLimitOverrides } from "../middleware/rateLimit";

const COOKIE = "refresh_token";

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge: config.jwt.refreshTtlSeconds * 1000,
  });
}

const loginSchema = z.object({ email: z.string().email(), senha: z.string().min(1) });
const totpSchema = z.object({ preauthToken: z.string().min(10), codigo: z.string().min(6) });

export function superAdminAuthRouter(rl: RateLimitOverrides = {}): Router {
  const router = Router();
  const loginLimiter = makeLoginLimiter(rl);

  // Passo 1: e-mail + senha → token de pré-autenticação (exige TOTP em seguida).
  router.post(
    "/login",
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { email, senha } = validateBody(loginSchema, req.body);
      const sa = await lookupSuperAdminByEmail(email);
      if (!sa || !(await verifyPassword(sa.senha_hash, senha))) {
        throw new AppError(401, "credenciais inválidas");
      }
      if (!sa.totp_enabled || !sa.totp_secret) {
        throw new AppError(403, "2FA (TOTP) não configurado — contate o administrador");
      }
      const preauthToken = signPreauthToken({ sub: sa.id, email });
      res.json({ preauthToken });
    }),
  );

  // Passo 2: valida o TOTP e emite a sessão.
  router.post(
    "/verify-totp",
    asyncHandler(async (req, res) => {
      const { preauthToken, codigo } = validateBody(totpSchema, req.body);
      let payload: { sub: string; email: string; stage: string };
      try {
        payload = verifyPreauthToken<{ sub: string; email: string }>(preauthToken);
      } catch {
        throw new AppError(401, "pré-autenticação inválida ou expirada");
      }
      if (payload.stage !== "2fa") throw new AppError(401, "pré-autenticação inválida");

      const sa = await lookupSuperAdminByEmail(payload.email);
      if (!sa || !sa.totp_secret || !verifyTotp(sa.totp_secret, codigo)) {
        throw new AppError(401, "código inválido");
      }
      const claims: AccessClaims = { sub: sa.id, type: "super_admin" };
      setRefreshCookie(res, await issueRefreshToken(claims));
      res.json({ accessToken: signAccessToken(claims), tokenType: "Bearer", expiresIn: config.jwt.accessTtlSeconds });
    }),
  );

  return router;
}
