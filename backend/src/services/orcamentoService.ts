/**
 * Finalidade: regras de negócio de Orçamento (CLAUDE.md 4.9, regras 10/12/18/19/20).
 * Como funciona: opera com o tenant fixado (RLS), em transação. Cadastrar exige ferramenta
 *   `aguardando_orcamento` e move para `aguardando_liberacao` (regra 18); tipo_reparo é
 *   derivado de Prestador.id_funcionario (não é escolha livre). Liberar cria o reparo por
 *   roteamento (regra 13) e move a ferramenta para `em_reparo` (regra 10). Recusar mantém
 *   o orçamento (regra 12) e devolve a ferramenta para `aguardando_orcamento` (regra 20).
 * Relações: usado por routes/orcamentos; usa schema, toolStatusMachine e cria reparos.
 */
import { and, eq, isNull } from "drizzle-orm";
import { withTenant } from "../db/client";
import {
  ferramentas,
  orcamentos,
  prestadores,
  reparosExternos,
  reparosInternos,
} from "../db/schema/index";
import { assertTransition } from "../domain/toolStatusMachine";
import { AppError } from "../http/middleware/errors";

const publicCols = {
  id: orcamentos.id,
  idFerramenta: orcamentos.idFerramenta,
  idPrestador: orcamentos.idPrestador,
  tipoReparo: orcamentos.tipoReparo,
  descricaoServico: orcamentos.descricaoServico,
  valorOrcamento: orcamentos.valorOrcamento,
  status: orcamentos.status,
  canceledAt: orcamentos.canceledAt,
  dataCadastro: orcamentos.dataCadastro,
};

export interface CadastrarOrcamentoInput {
  idFerramenta: string;
  idPrestador: string;
  valorOrcamento: number;
  descricaoServico?: string | null;
}

export async function cadastrarOrcamento(tenantId: string, input: CadastrarOrcamentoInput) {
  return withTenant(tenantId, async (tx) => {
    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(and(eq(ferramentas.id, input.idFerramenta), isNull(ferramentas.deletedAt)))
      .limit(1);
    if (!fer) throw new AppError(404, "ferramenta não encontrada");
    if (fer.status !== "aguardando_orcamento") {
      throw new AppError(409, "ferramenta não está aguardando orçamento");
    }
    const [prest] = await tx
      .select({ id: prestadores.id, idFuncionario: prestadores.idFuncionario })
      .from(prestadores)
      .where(and(eq(prestadores.id, input.idPrestador), isNull(prestadores.deletedAt)))
      .limit(1);
    if (!prest) throw new AppError(400, "prestador inválido para este tenant");

    // tipo_reparo derivado (4.9): interno se o prestador for um funcionário, senão externo.
    const tipoReparo = prest.idFuncionario ? "interno" : "externo";
    assertTransition("aguardando_orcamento", "aguardando_liberacao");

    const [orc] = await tx
      .insert(orcamentos)
      .values({
        tenantId,
        idFerramenta: input.idFerramenta,
        idPrestador: input.idPrestador,
        tipoReparo,
        descricaoServico: input.descricaoServico ?? null,
        valorOrcamento: String(input.valorOrcamento),
        status: "pendente",
      })
      .returning(publicCols);

    await tx
      .update(ferramentas)
      .set({ status: "aguardando_liberacao", updatedAt: new Date() })
      .where(eq(ferramentas.id, input.idFerramenta));

    return orc;
  });
}

export async function editarOrcamento(
  tenantId: string,
  id: string,
  input: { valorOrcamento?: number; descricaoServico?: string | null },
) {
  return withTenant(tenantId, async (tx) => {
    const [orc] = await tx
      .select({ status: orcamentos.status, canceledAt: orcamentos.canceledAt })
      .from(orcamentos)
      .where(eq(orcamentos.id, id))
      .limit(1);
    if (!orc) throw new AppError(404, "orçamento não encontrado");
    if (orc.canceledAt) throw new AppError(409, "orçamento cancelado");
    if (orc.status !== "pendente") throw new AppError(409, "só é possível editar orçamento pendente");

    const [row] = await tx
      .update(orcamentos)
      .set({
        ...(input.valorOrcamento !== undefined ? { valorOrcamento: String(input.valorOrcamento) } : {}),
        ...(input.descricaoServico !== undefined ? { descricaoServico: input.descricaoServico } : {}),
        updatedAt: new Date(),
      })
      .where(eq(orcamentos.id, id))
      .returning(publicCols);
    return row;
  });
}

// Liberar (aprovar): cria o reparo por roteamento (regra 13) e move p/ em_reparo (regra 10).
export async function liberarOrcamento(tenantId: string, requisitanteId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const [orc] = await tx.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
    if (!orc) throw new AppError(404, "orçamento não encontrado");
    if (orc.canceledAt) throw new AppError(409, "orçamento cancelado");
    if (orc.status !== "pendente") throw new AppError(409, "orçamento não está pendente");

    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(eq(ferramentas.id, orc.idFerramenta))
      .limit(1);
    if (!fer || fer.status !== "aguardando_liberacao") {
      throw new AppError(409, "ferramenta não está aguardando liberação");
    }
    assertTransition("aguardando_liberacao", "em_reparo");

    const [prest] = await tx
      .select({ idFuncionario: prestadores.idFuncionario })
      .from(prestadores)
      .where(eq(prestadores.id, orc.idPrestador))
      .limit(1);

    await tx.update(orcamentos).set({ status: "liberado", updatedAt: new Date() }).where(eq(orcamentos.id, id));

    // Roteamento (regra 13): interno se o prestador é um funcionário; senão externo.
    let reparo;
    if (prest?.idFuncionario) {
      [reparo] = await tx
        .insert(reparosInternos)
        .values({
          tenantId,
          idFerramenta: orc.idFerramenta,
          idFuncionarioRequisitante: requisitanteId,
          idFuncionarioResponsavel: prest.idFuncionario,
          idOrcamento: id,
        })
        .returning();
    } else {
      [reparo] = await tx
        .insert(reparosExternos)
        .values({
          tenantId,
          idFerramenta: orc.idFerramenta,
          idFuncionarioRequisitante: requisitanteId,
          idPrestador: orc.idPrestador,
          idOrcamento: id,
        })
        .returning();
    }

    await tx
      .update(ferramentas)
      .set({ status: "em_reparo", updatedAt: new Date() })
      .where(eq(ferramentas.id, orc.idFerramenta));

    return { tipo: prest?.idFuncionario ? "interno" : "externo", reparo };
  });
}

// Recusar: mantém o orçamento (regra 12) e devolve a ferramenta p/ aguardando_orcamento (regra 20).
export async function recusarOrcamento(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const [orc] = await tx
      .select({ status: orcamentos.status, canceledAt: orcamentos.canceledAt, idFerramenta: orcamentos.idFerramenta })
      .from(orcamentos)
      .where(eq(orcamentos.id, id))
      .limit(1);
    if (!orc) throw new AppError(404, "orçamento não encontrado");
    if (orc.canceledAt) throw new AppError(409, "orçamento cancelado");
    if (orc.status !== "pendente") throw new AppError(409, "orçamento não está pendente");

    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(eq(ferramentas.id, orc.idFerramenta))
      .limit(1);
    if (fer) assertTransition(fer.status, "aguardando_orcamento");

    const [row] = await tx
      .update(orcamentos)
      .set({ status: "recusado", updatedAt: new Date() })
      .where(eq(orcamentos.id, id))
      .returning(publicCols);

    await tx
      .update(ferramentas)
      .set({ status: "aguardando_orcamento", updatedAt: new Date() })
      .where(eq(ferramentas.id, orc.idFerramenta));

    return row;
  });
}

export async function listOrcamentos(
  tenantId: string,
  filter: { idFerramenta?: string; status?: "pendente" | "liberado" | "recusado" } = {},
) {
  return withTenant(tenantId, (tx) => {
    const filters = [];
    if (filter.idFerramenta) filters.push(eq(orcamentos.idFerramenta, filter.idFerramenta));
    if (filter.status) filters.push(eq(orcamentos.status, filter.status));
    const q = tx.select(publicCols).from(orcamentos);
    return filters.length ? q.where(and(...filters)) : q;
  });
}

export async function getOrcamento(tenantId: string, id: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx.select(publicCols).from(orcamentos).where(eq(orcamentos.id, id)).limit(1),
  );
  if (!row) throw new AppError(404, "orçamento não encontrado");
  return row;
}
