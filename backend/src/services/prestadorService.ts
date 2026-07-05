/**
 * Finalidade: regras de negócio de Prestador (CRUD + validação de vínculo com funcionário).
 * Como funciona: opera com o tenant fixado (RLS). idFuncionario (nullable) indica que o
 *   "prestador" é um funcionário interno (base do roteamento de reparo — 4.3/4.8).
 *   Soft-delete (D9) bloqueia se houver reparo externo em aberto ou orçamento pendente.
 * Relações: usado por routes/prestadores; usa db/client, schema e funcionarioService.
 */
import { and, eq, ilike, isNull } from "drizzle-orm";
import { withTenant } from "../db/client";
import { funcionarios, orcamentos, prestadores, reparosExternos } from "../db/schema/index";
import { AppError } from "../http/middleware/errors";

const publicCols = {
  id: prestadores.id,
  nome: prestadores.nome,
  endereco: prestadores.endereco,
  telefone: prestadores.telefone,
  idFuncionario: prestadores.idFuncionario,
};

export interface CreatePrestadorInput {
  nome: string;
  endereco?: string | null;
  telefone?: string | null;
  idFuncionario?: string | null;
}

async function assertFuncionarioValido(tenantId: string, idFuncionario: string) {
  const [f] = await withTenant(tenantId, (tx) =>
    tx
      .select({ id: funcionarios.id })
      .from(funcionarios)
      .where(and(eq(funcionarios.id, idFuncionario), isNull(funcionarios.deletedAt)))
      .limit(1),
  );
  if (!f) throw new AppError(400, "id_funcionario inválido para este tenant");
}

export async function createPrestador(tenantId: string, input: CreatePrestadorInput) {
  if (input.idFuncionario) await assertFuncionarioValido(tenantId, input.idFuncionario);
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .insert(prestadores)
      .values({
        tenantId,
        nome: input.nome,
        endereco: input.endereco ?? null,
        telefone: input.telefone ?? null,
        idFuncionario: input.idFuncionario ?? null,
      })
      .returning(publicCols),
  );
  return row;
}

export async function listPrestadores(tenantId: string, search?: string) {
  return withTenant(tenantId, (tx) => {
    const filters = [isNull(prestadores.deletedAt)];
    if (search) filters.push(ilike(prestadores.nome, `%${search}%`));
    return tx.select(publicCols).from(prestadores).where(and(...filters));
  });
}

export async function getPrestador(tenantId: string, id: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select(publicCols)
      .from(prestadores)
      .where(and(eq(prestadores.id, id), isNull(prestadores.deletedAt)))
      .limit(1),
  );
  if (!row) throw new AppError(404, "prestador não encontrado");
  return row;
}

export async function updatePrestador(
  tenantId: string,
  id: string,
  input: Partial<CreatePrestadorInput>,
) {
  await getPrestador(tenantId, id);
  if (input.idFuncionario) await assertFuncionarioValido(tenantId, input.idFuncionario);
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .update(prestadores)
      .set({
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.endereco !== undefined ? { endereco: input.endereco } : {}),
        ...(input.telefone !== undefined ? { telefone: input.telefone } : {}),
        ...(input.idFuncionario !== undefined ? { idFuncionario: input.idFuncionario } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(prestadores.id, id), isNull(prestadores.deletedAt)))
      .returning(publicCols),
  );
  return row;
}

async function prestadorBlocker(tenantId: string, id: string): Promise<string | null> {
  return withTenant(tenantId, async (tx) => {
    const [re] = await tx
      .select({ id: reparosExternos.id })
      .from(reparosExternos)
      .where(
        and(
          eq(reparosExternos.idPrestador, id),
          isNull(reparosExternos.dataFim),
          isNull(reparosExternos.canceledAt),
        ),
      )
      .limit(1);
    if (re) return "há reparo externo em aberto vinculado";

    const [orc] = await tx
      .select({ id: orcamentos.id })
      .from(orcamentos)
      .where(
        and(eq(orcamentos.idPrestador, id), eq(orcamentos.status, "pendente"), isNull(orcamentos.canceledAt)),
      )
      .limit(1);
    if (orc) return "há orçamento pendente vinculado";

    return null;
  });
}

export async function softDeletePrestador(tenantId: string, id: string) {
  await getPrestador(tenantId, id);
  const blocker = await prestadorBlocker(tenantId, id);
  if (blocker) throw new AppError(409, `não é possível excluir: ${blocker}`);
  await withTenant(tenantId, (tx) =>
    tx.update(prestadores).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(prestadores.id, id)),
  );
  return { ok: true };
}
