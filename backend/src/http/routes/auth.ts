/**
 * Finalidade: rotas de autenticação de funcionário/Root (CLAUDE.md 5.2).
 * Como funciona: fluxo em 2 passos — /login valida telefone+senha e dispara OTP via
 *   NotificationProvider; /verify-otp confere o código, checa o pagamento do tenant e
 *   emite access token (JWT) + refresh token (cookie httpOnly). /refresh rotaciona;
 *   /logout revoga; /me expõe as claims.
 * Relações: usa auth/* (password, otp, tokens), authRepo, notifications e middlewares.
 */
import { Router, type Response } from "express";
import { z } from "zod";
import {
  consumeChallenge,
  createOtpChallenge,
  getFuncionarioRoles,
  getOpenChallenge,
  getTenantStatus,
  incrementChallengeAttempts,
  lookupFuncionarioByPhone,
} from "../../auth/authRepo";
import { hashOtp, generateOtp, verifyOtp } from "../../auth/otp";
import { verifyPassword } from "../../auth/password";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type AccessClaims,
} from "../../auth/tokens";
import { config } from "../../config/env";
import { getNotificationProvider } from "../../notifications/index";
import { authenticate } from "../middleware/authenticate";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";
import { makeLoginLimiter, makeOtpLimiter, type RateLimitOverrides } from "../middleware/rateLimit";

const COOKIE = "refresh_token";

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/auth",
    maxAge: config.jwt.refreshTtlSeconds * 1000,
  });
}

const loginSchema = z.object({ telefone: z.string().min(3), senha: z.string().min(1) });
const verifySchema = z.object({ challengeId: z.string().uuid(), codigo: z.string().min(4) });

export function authRouter(rl: RateLimitOverrides = {}): Router {
  const router = Router();
  const loginLimiter = makeLoginLimiter(rl);
  const otpLimiter = makeOtpLimiter(rl);

  // Passo 1: telefone + senha → dispara OTP.
  router.post(
    "/login",
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { telefone, senha } = validateBody(loginSchema, req.body);
      const f = await lookupFuncionarioByPhone(telefone);
      // Falha genérica para não revelar se o telefone existe.
      if (!f || !f.senha_hash || !(await verifyPassword(f.senha_hash, senha))) {
        throw new AppError(401, "credenciais inválidas");
      }
      const code = generateOtp();
      const challenge = await createOtpChallenge({
        funcionarioId: f.id,
        tenantId: f.tenant_id,
        codeHash: hashOtp(code),
        expiresAt: new Date(Date.now() + config.otp.ttlSeconds * 1000),
        maxAttempts: config.otp.maxAttempts,
      });
      await getNotificationProvider().sendMessage(
        telefone,
        `Almoxarifado: seu código de acesso é ${code}`,
        "otp",
      );
      res.json({ challengeId: challenge.id, expiresInSeconds: config.otp.ttlSeconds });
    }),
  );

  // Passo 2: valida o OTP, checa pagamento e emite a sessão.
  router.post(
    "/verify-otp",
    otpLimiter,
    asyncHandler(async (req, res) => {
      const { challengeId, codigo } = validateBody(verifySchema, req.body);
      const ch = await getOpenChallenge(challengeId);
      if (!ch) throw new AppError(400, "desafio inválido ou já utilizado");
      if (ch.expiresAt.getTime() < Date.now()) throw new AppError(400, "código expirado");
      if (ch.attempts >= ch.maxAttempts) throw new AppError(429, "tentativas esgotadas");
      if (!verifyOtp(codigo, ch.codeHash)) {
        await incrementChallengeAttempts(ch.id);
        throw new AppError(401, "código inválido");
      }
      await consumeChallenge(ch.id);

      // Bloqueio por pagamento (CLAUDE.md 5.2).
      const status = await getTenantStatus(ch.tenantId);
      if (status !== "regular") throw new AppError(403, "acesso bloqueado, contatar suporte");

      const roles = await getFuncionarioRoles(ch.tenantId, ch.funcionarioId);
      const claims: AccessClaims = {
        sub: ch.funcionarioId,
        type: "funcionario",
        tenantId: ch.tenantId,
        isRoot: roles?.isRoot ?? false,
        isAlmoxarife: roles?.isAlmoxarife ?? false,
      };
      const accessToken = signAccessToken(claims);
      setRefreshCookie(res, await issueRefreshToken(claims));
      res.json({ accessToken, tokenType: "Bearer", expiresIn: config.jwt.accessTtlSeconds });
    }),
  );

  // Rotação do refresh token (revoga o antigo, emite novo).
  router.post(
    "/refresh",
    asyncHandler(async (req, res) => {
      const raw = req.cookies?.[COOKIE];
      if (!raw) throw new AppError(401, "refresh ausente");
      const rotated = await rotateRefreshToken(raw);
      if (!rotated) throw new AppError(401, "refresh inválido");
      if (rotated.claims.type === "funcionario" && rotated.claims.tenantId) {
        const status = await getTenantStatus(rotated.claims.tenantId);
        if (status !== "regular") throw new AppError(403, "acesso bloqueado, contatar suporte");
      }
      setRefreshCookie(res, rotated.raw);
      res.json({ accessToken: signAccessToken(rotated.claims), tokenType: "Bearer", expiresIn: config.jwt.accessTtlSeconds });
    }),
  );

  router.post(
    "/logout",
    asyncHandler(async (req, res) => {
      const raw = req.cookies?.[COOKIE];
      if (raw) await revokeRefreshToken(raw);
      res.clearCookie(COOKIE, { path: "/auth" });
      res.json({ ok: true });
    }),
  );

  router.get("/me", authenticate, (req, res) => {
    res.json({ auth: req.auth });
  });

  return router;
}
