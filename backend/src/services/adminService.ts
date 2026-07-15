/**
 * Finalidade: operações do super-admin (nível plataforma, cross-tenant) — CLAUDE.md 1/2.
 * Como funciona: usa as funções SECURITY DEFINER (superadmin_*) via db.execute, pois o
 *   super-admin opera fora do contexto de tenant (RLS/almox_app não alcançam). Onboarding
 *   hasheia a senha do Root (argon2) antes de chamar a função.
 * Relações: usado por routes/admin; usa db/client, payments? não; auth/password.
 */
import { sql } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { db } from "../db/client";
import { AppError } from "../http/middleware/errors";

export async function listTenants() {
  const res = await db.execute(sql`SELECT * FROM superadmin_list_tenants()`);
  return res.rows;
}

export interface OnboardingInput {
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco?: string | null;
  root: { nome: string; telefone: string; senha: string };
}

export async function createTenant(input: OnboardingInput) {
  const senhaHash = await hashPassword(input.root.senha);
  try {
    const res = await db.execute(sql`
      SELECT * FROM superadmin_create_tenant(
        ${input.razaoSocial}, ${input.cnpj}, ${input.email}, ${input.telefone},
        ${input.endereco ?? null}, ${input.root.nome}, ${input.root.telefone}, ${senhaHash}
      )`);
    return res.rows[0];
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      throw new AppError(409, "CNPJ ou telefone já cadastrado");
    }
    throw err;
  }
}

export async function setTenantAtivo(tenantId: string, ativo: boolean) {
  await db.execute(sql`SELECT superadmin_set_tenant_ativo(${tenantId}::uuid, ${ativo})`);
  return { id: tenantId, ativo };
}
