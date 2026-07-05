/**
 * Finalidade: regras de negócio de Ferramenta (CRUD + ações da máquina de estados 4.6).
 * Como funciona: opera com o tenant fixado (RLS). Ações (enviar/retornar reparo, sucatear)
 *   validam a transição via toolStatusMachine. Sucatear cancela reparo/orçamento em aberto
 *   (D13). Soft-delete só é permitido em estados terminais/ociosos (disponivel|sucateada).
 * Relações: usado por routes/ferramentas; usa db/client, schema e domain/toolStatusMachine.
 */
import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { withTenant } from "../db/client";
import { ferramentas, orcamentos, reparosExternos, reparosInternos } from "../db/schema/index";
import { assertTransition, canScrap, type ToolStatus } from "../domain/toolStatusMachine";
import { AppError } from "../http/middleware/errors";

const publicCols = {
  id: ferramentas.id,
  tipo: ferramentas.tipo,
  descricao: ferramentas.descricao,
  marca: ferramentas.marca,
  status: ferramentas.status,
};

export interface CreateFerramentaInput {
  tipo: string;
  descricao?: string | null;
  marca?: string | null;
}

async function loadStatus(tenantId: string, id: string): Promise<ToolStatus> {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(and(eq(ferramentas.id, id), isNull(ferramentas.deletedAt)))
      .limit(1),
  );
  if (!row) throw new AppError(404, "ferramenta não encontrada");
  return row.status;
}

export async function createFerramenta(tenantId: string, input: CreateFerramentaInput) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .insert(ferramentas)
      .values({
        tenantId,
        tipo: input.tipo,
        descricao: input.descricao ?? null,
        marca: input.marca ?? null,
      })
      .returning(publicCols),
  );
  return row;
}

export async function listFerramentas(
  tenantId: string,
  opts: { search?: string; status?: ToolStatus } = {},
) {
  return withTenant(tenantId, (tx) => {
    const filters = [isNull(ferramentas.deletedAt)];
    if (opts.status) filters.push(eq(ferramentas.status, opts.status));
    if (opts.search) {
      const s = `%${opts.search}%`;
      filters.push(
        or(ilike(ferramentas.tipo, s), ilike(ferramentas.marca, s), ilike(ferramentas.descricao, s))!,
      );
    }
    return tx.select(publicCols).from(ferramentas).where(and(...filters));
  });
}

export async function getFerramenta(tenantId: string, id: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select(publicCols)
      .from(ferramentas)
      .where(and(eq(ferramentas.id, id), isNull(ferramentas.deletedAt)))
      .limit(1),
  );
  if (!row) throw new AppError(404, "ferramenta não encontrada");
  return row;
}

export async function updateFerramenta(
  tenantId: string,
  id: string,
  input: Partial<CreateFerramentaInput>,
) {
  await getFerramenta(tenantId, id);
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .update(ferramentas)
      .set({
        ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
        ...(input.descricao !== undefined ? { descricao: input.descricao } : {}),
        ...(input.marca !== undefined ? { marca: input.marca } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(ferramentas.id, id), isNull(ferramentas.deletedAt)))
      .returning(publicCols),
  );
  return row;
}

// Exclusão só em estados ociosos/terminais — status é ciclo de vida, não exclusão.
export async function softDeleteFerramenta(tenantId: string, id: string) {
  const status = await loadStatus(tenantId, id);
  if (status !== "disponivel" && status !== "sucateada") {
    throw new AppError(409, `não é possível excluir ferramenta com status ${status}`);
  }
  await withTenant(tenantId, (tx) =>
    tx.update(ferramentas).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(ferramentas.id, id)),
  );
  return { ok: true };
}

async function setStatus(tenantId: string, id: string, to: ToolStatus) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .update(ferramentas)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(ferramentas.id, id), isNull(ferramentas.deletedAt)))
      .returning(publicCols),
  );
  return row;
}

// Enviar para reparo — só a partir de `disponivel` (regra 15): → aguardando_orcamento.
export async function enviarParaReparo(tenantId: string, id: string) {
  const from = await loadStatus(tenantId, id);
  if (from !== "disponivel") {
    throw new AppError(409, "só é possível enviar para reparo uma ferramenta disponível");
  }
  assertTransition(from, "aguardando_orcamento");
  return setStatus(tenantId, id, "aguardando_orcamento");
}

// Retornar do reparo — só a partir de `aguardando_devolucao`: → disponivel.
export async function retornarDoReparo(tenantId: string, id: string) {
  const from = await loadStatus(tenantId, id);
  if (from !== "aguardando_devolucao") {
    throw new AppError(409, "ferramenta não está aguardando devolução");
  }
  assertTransition(from, "disponivel");
  return setStatus(tenantId, id, "disponivel");
}

// Sucatear — qualquer estado exceto `alugada`; cancela reparo/orçamento em aberto (D13).
export async function sucatear(tenantId: string, id: string) {
  const from = await loadStatus(tenantId, id);
  if (!canScrap(from)) {
    throw new AppError(
      409,
      from === "sucateada" ? "ferramenta já está sucateada" : "ferramenta alugada não pode ser sucateada",
    );
  }
  assertTransition(from, "sucateada");
  return withTenant(tenantId, async (tx) => {
    const agora = new Date();
    // D13: reparos e orçamentos em aberto são cancelados (mantidos na base).
    await tx
      .update(reparosExternos)
      .set({ canceledAt: agora })
      .where(
        and(
          eq(reparosExternos.idFerramenta, id),
          isNull(reparosExternos.dataFim),
          isNull(reparosExternos.canceledAt),
        ),
      );
    await tx
      .update(reparosInternos)
      .set({ canceledAt: agora })
      .where(
        and(
          eq(reparosInternos.idFerramenta, id),
          isNull(reparosInternos.dataFim),
          isNull(reparosInternos.canceledAt),
        ),
      );
    await tx
      .update(orcamentos)
      .set({ canceledAt: agora })
      .where(
        and(
          eq(orcamentos.idFerramenta, id),
          isNull(orcamentos.canceledAt),
          inArray(orcamentos.status, ["pendente", "liberado"]),
        ),
      );
    const [row] = await tx
      .update(ferramentas)
      .set({ status: "sucateada", updatedAt: agora })
      .where(and(eq(ferramentas.id, id), isNull(ferramentas.deletedAt)))
      .returning(publicCols);
    return row;
  });
}
