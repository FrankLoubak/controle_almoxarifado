/**
 * Finalidade: emissão/verificação de tokens de sessão (D5).
 * Como funciona: access token é JWT curto (15min); refresh token é opaco (aleatório),
 *   persistido em refresh_tokens apenas como HMAC (revogável). Rotação no /refresh.
 * Relações: usa client.db (tabela refresh_tokens) e config; consumido pelas rotas de auth
 *   e pelo middleware authenticate.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { db } from "../db/client";
import { refreshTokens } from "../db/schema/index";

export type SubjectType = "funcionario" | "super_admin";

export interface AccessClaims {
  sub: string;
  type: SubjectType;
  tenantId?: string;
  isRoot?: boolean;
  isAlmoxarife?: boolean;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtlSeconds });
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, config.jwt.accessSecret) as AccessClaims;
}

// Token de pré-autenticação (entre senha e 2FA). Carrega o estágio pendente.
export function signPreauthToken(payload: Record<string, unknown>): string {
  return jwt.sign({ ...payload, stage: "2fa" }, config.jwt.accessSecret, {
    expiresIn: config.jwt.preauthTtlSeconds,
  });
}

export function verifyPreauthToken<T = Record<string, unknown>>(token: string): T & { stage: string } {
  return jwt.verify(token, config.jwt.accessSecret) as T & { stage: string };
}

function hashToken(raw: string): string {
  return createHmac("sha256", config.tokenPepper).update(raw).digest("hex");
}

// Emite um refresh token opaco e persiste seu hash + snapshot das claims. Retorna o
// token em claro (uma vez).
export async function issueRefreshToken(claims: AccessClaims): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000);
  await db.insert(refreshTokens).values({
    subjectType: claims.type,
    subjectId: claims.sub,
    tokenHash: hashToken(raw),
    claims,
    expiresAt,
  });
  return raw;
}

// Valida um refresh token (não revogado e não expirado). Retorna o registro ou null.
export async function findValidRefreshToken(raw: string) {
  const hash = hashToken(raw);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  // Comparação em tempo constante do hash (defesa extra além do WHERE).
  if (!row) return null;
  const ok =
    row.tokenHash.length === hash.length &&
    timingSafeEqual(Buffer.from(row.tokenHash), Buffer.from(hash));
  return ok ? row : null;
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashToken(raw)));
}

// Rotação: revoga o refresh atual e emite um novo com as mesmas claims. Retorna o novo
// token em claro, ou null se o atual for inválido/expirado/revogado.
export async function rotateRefreshToken(raw: string): Promise<{ raw: string; claims: AccessClaims } | null> {
  const row = await findValidRefreshToken(raw);
  if (!row) return null;
  await revokeRefreshToken(raw);
  const claims = row.claims as AccessClaims;
  const next = await issueRefreshToken(claims);
  return { raw: next, claims };
}
