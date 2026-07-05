/**
 * Finalidade: acesso a dados da autenticação (lookups cross-tenant + challenges de OTP).
 * Como funciona: usa as funções SECURITY DEFINER (auth_lookup_*) para achar o usuário por
 *   telefone/e-mail global (D18) e o Drizzle para as tabelas de plataforma otp_challenges
 *   e refresh_tokens. O status da assinatura é lido com o tenant fixado (self-policy).
 * Relações: consumido pelas rotas de auth; usa db/client (withTenant) e schema.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, withTenant } from "../db/client";
import { funcionarios, otpChallenges, tenants } from "../db/schema/index";

export interface FuncionarioAuth {
  id: string;
  tenant_id: string;
  senha_hash: string | null;
  status_almoxarife: boolean;
  is_root: boolean;
  tenant_status: "regular" | "atrasado" | "cancelado";
}

export async function lookupFuncionarioByPhone(phone: string): Promise<FuncionarioAuth | null> {
  const res = await db.execute(sql`SELECT * FROM auth_lookup_funcionario(${phone})`);
  return (res.rows[0] as unknown as FuncionarioAuth | undefined) ?? null;
}

export interface SuperAdminAuth {
  id: string;
  senha_hash: string;
  totp_secret: string | null;
  totp_enabled: boolean;
}

export async function lookupSuperAdminByEmail(email: string): Promise<SuperAdminAuth | null> {
  const res = await db.execute(sql`SELECT * FROM auth_lookup_super_admin(${email})`);
  return (res.rows[0] as unknown as SuperAdminAuth | undefined) ?? null;
}

export async function createOtpChallenge(input: {
  funcionarioId: string;
  tenantId: string;
  codeHash: string;
  expiresAt: Date;
  maxAttempts: number;
}) {
  const [row] = await db
    .insert(otpChallenges)
    .values({
      funcionarioId: input.funcionarioId,
      tenantId: input.tenantId,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      maxAttempts: input.maxAttempts,
    })
    .returning();
  return row;
}

export async function getOpenChallenge(id: string) {
  const [row] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.id, id), isNull(otpChallenges.consumedAt)))
    .limit(1);
  return row ?? null;
}

export async function incrementChallengeAttempts(id: string) {
  await db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(eq(otpChallenges.id, id));
}

export async function consumeChallenge(id: string) {
  await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, id));
}

// Status da assinatura do tenant, lido com o tenant fixado (política tenant_self_isolation).
export async function getTenantStatus(tenantId: string): Promise<string | null> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.select({ status: tenants.statusAssinatura }).from(tenants).where(eq(tenants.id, tenantId)),
  );
  return rows[0]?.status ?? null;
}

// Papéis do funcionário (para montar as claims após o 2FA), lidos com o tenant fixado.
export async function getFuncionarioRoles(tenantId: string, funcionarioId: string) {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({ isRoot: funcionarios.isRoot, isAlmoxarife: funcionarios.statusAlmoxarife })
      .from(funcionarios)
      .where(eq(funcionarios.id, funcionarioId)),
  );
  return rows[0] ?? null;
}
