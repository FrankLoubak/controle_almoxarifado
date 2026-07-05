/**
 * Finalidade: regras de negócio de Funcionário (CRUD + promoção a almoxarife).
 * Como funciona: opera sempre com o tenant fixado (withTenant → RLS). Soft-delete (D9)
 *   bloqueia exclusão com vínculo ativo (empréstimo/reparo em aberto, Root, ou referência
 *   por prestador ativo). Promoção a almoxarife exige senha (hash argon2) — Root only.
 * Relações: usado por routes/funcionarios; usa db/client (withTenant), schema e password.
 */
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { withTenant } from "../db/client";
import {
  emprestimos,
  funcionarios,
  prestadores,
  reparosExternos,
  reparosInternos,
  tenants,
} from "../db/schema/index";
import { AppError } from "../http/middleware/errors";

// Projeção pública (nunca expõe senha_hash).
const publicCols = {
  id: funcionarios.id,
  nome: funcionarios.nome,
  numeroTelefone: funcionarios.numeroTelefone,
  cpf: funcionarios.cpf,
  email: funcionarios.email,
  dataAdmissao: funcionarios.dataAdmissao,
  dataCadastro: funcionarios.dataCadastro,
  statusAlmoxarife: funcionarios.statusAlmoxarife,
  isRoot: funcionarios.isRoot,
};

export interface CreateFuncionarioInput {
  nome: string;
  numeroTelefone: string;
  cpf?: string | null;
  email?: string | null;
  dataAdmissao?: string | null;
}

function mapUniqueViolation(err: unknown): never {
  if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
    throw new AppError(409, "telefone já cadastrado");
  }
  throw err;
}

export async function createFuncionario(tenantId: string, input: CreateFuncionarioInput) {
  return withTenant(tenantId, async (tx) => {
    try {
      // Criado como depositário (sem login); vira almoxarife só via promoção (regra 7).
      const [row] = await tx
        .insert(funcionarios)
        .values({
          tenantId,
          nome: input.nome,
          numeroTelefone: input.numeroTelefone,
          cpf: input.cpf ?? null,
          email: input.email ?? null,
          dataAdmissao: input.dataAdmissao ?? null,
        })
        .returning(publicCols);
      return row;
    } catch (err) {
      mapUniqueViolation(err);
    }
  });
}

export async function listFuncionarios(tenantId: string, search?: string) {
  return withTenant(tenantId, (tx) => {
    const filters = [isNull(funcionarios.deletedAt)];
    if (search) filters.push(ilike(funcionarios.nome, `%${search}%`));
    return tx.select(publicCols).from(funcionarios).where(and(...filters));
  });
}

export async function getFuncionario(tenantId: string, id: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select(publicCols)
      .from(funcionarios)
      .where(and(eq(funcionarios.id, id), isNull(funcionarios.deletedAt)))
      .limit(1),
  );
  if (!row) throw new AppError(404, "funcionário não encontrado");
  return row;
}

export async function updateFuncionario(
  tenantId: string,
  id: string,
  input: Partial<CreateFuncionarioInput>,
) {
  await getFuncionario(tenantId, id); // garante existência (e não-deletado)
  return withTenant(tenantId, async (tx) => {
    try {
      const [row] = await tx
        .update(funcionarios)
        .set({
          ...(input.nome !== undefined ? { nome: input.nome } : {}),
          ...(input.numeroTelefone !== undefined ? { numeroTelefone: input.numeroTelefone } : {}),
          ...(input.cpf !== undefined ? { cpf: input.cpf } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.dataAdmissao !== undefined ? { dataAdmissao: input.dataAdmissao } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(funcionarios.id, id), isNull(funcionarios.deletedAt)))
        .returning(publicCols);
      return row;
    } catch (err) {
      mapUniqueViolation(err);
    }
  });
}

// Verifica vínculos que impedem a exclusão (D9).
async function hasActiveLinks(tenantId: string, id: string): Promise<string | null> {
  return withTenant(tenantId, async (tx) => {
    // Root não pode ser excluído.
    const [tenant] = await tx
      .select({ root: tenants.idRootFuncionario })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (tenant?.root === id) return "funcionário é o Root da empresa";

    const [loan] = await tx
      .select({ id: emprestimos.id })
      .from(emprestimos)
      .where(
        and(
          or(eq(emprestimos.idDepositario, id), eq(emprestimos.idFuncionarioEmprestador, id)),
          isNull(emprestimos.dataRetorno),
        ),
      )
      .limit(1);
    if (loan) return "há empréstimo ativo vinculado";

    const [ri] = await tx
      .select({ id: reparosInternos.id })
      .from(reparosInternos)
      .where(
        and(
          or(
            eq(reparosInternos.idFuncionarioRequisitante, id),
            eq(reparosInternos.idFuncionarioResponsavel, id),
          ),
          isNull(reparosInternos.dataFim),
          isNull(reparosInternos.canceledAt),
        ),
      )
      .limit(1);
    if (ri) return "há reparo interno em aberto vinculado";

    const [re] = await tx
      .select({ id: reparosExternos.id })
      .from(reparosExternos)
      .where(
        and(
          eq(reparosExternos.idFuncionarioRequisitante, id),
          isNull(reparosExternos.dataFim),
          isNull(reparosExternos.canceledAt),
        ),
      )
      .limit(1);
    if (re) return "há reparo externo em aberto vinculado";

    const [prest] = await tx
      .select({ id: prestadores.id })
      .from(prestadores)
      .where(and(eq(prestadores.idFuncionario, id), isNull(prestadores.deletedAt)))
      .limit(1);
    if (prest) return "funcionário está vinculado a um prestador ativo";

    return null;
  });
}

export async function softDeleteFuncionario(tenantId: string, id: string) {
  await getFuncionario(tenantId, id);
  const blocker = await hasActiveLinks(tenantId, id);
  if (blocker) throw new AppError(409, `não é possível excluir: ${blocker}`);
  await withTenant(tenantId, (tx) =>
    tx.update(funcionarios).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(funcionarios.id, id)),
  );
  return { ok: true };
}

// Promoção a almoxarife (Root only) — exige criação de senha (4.2).
export async function promoteToAlmoxarife(tenantId: string, id: string, senha: string) {
  const f = await getFuncionario(tenantId, id);
  if (f.statusAlmoxarife) throw new AppError(409, "funcionário já é almoxarife");
  const senhaHash = await hashPassword(senha);
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .update(funcionarios)
      .set({ statusAlmoxarife: true, senhaHash, updatedAt: new Date() })
      .where(and(eq(funcionarios.id, id), isNull(funcionarios.deletedAt)))
      .returning(publicCols),
  );
  return row;
}
