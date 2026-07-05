/**
 * Finalidade: regras de negócio de Reparo (interno sem orçamento, conclusão, listagem).
 * Como funciona: opera com o tenant fixado (RLS), em transação. Reparo interno sem
 *   orçamento (regra 11): prestador interno + ferramenta `aguardando_orcamento` →
 *   `em_reparo` com id_orcamento nulo. Concluir: reparo em aberto → dataFim + descrição e
 *   ferramenta `em_reparo` → `aguardando_devolucao`. Externo sempre exige orçamento (regra 10).
 * Relações: usado por routes/reparos; usa schema, toolStatusMachine. Orçamento→reparo é
 *   criado em orcamentoService (liberar).
 */
import { and, eq, isNull } from "drizzle-orm";
import { withTenant } from "../db/client";
import { ferramentas, prestadores, reparosExternos, reparosInternos } from "../db/schema/index";
import { assertTransition } from "../domain/toolStatusMachine";
import { AppError } from "../http/middleware/errors";

// Reparo interno sem orçamento (regra 11): só para prestador interno (id_funcionario set).
export async function iniciarReparoInternoDireto(
  tenantId: string,
  requisitanteId: string,
  input: { idFerramenta: string; idPrestador: string },
) {
  return withTenant(tenantId, async (tx) => {
    const [prest] = await tx
      .select({ idFuncionario: prestadores.idFuncionario })
      .from(prestadores)
      .where(and(eq(prestadores.id, input.idPrestador), isNull(prestadores.deletedAt)))
      .limit(1);
    if (!prest) throw new AppError(400, "prestador inválido para este tenant");
    if (!prest.idFuncionario) {
      throw new AppError(400, "reparo externo exige orçamento (regra 10)");
    }

    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(and(eq(ferramentas.id, input.idFerramenta), isNull(ferramentas.deletedAt)))
      .limit(1);
    if (!fer) throw new AppError(404, "ferramenta não encontrada");
    if (fer.status !== "aguardando_orcamento") {
      throw new AppError(409, "ferramenta não está aguardando orçamento");
    }
    assertTransition("aguardando_orcamento", "em_reparo");

    const [reparo] = await tx
      .insert(reparosInternos)
      .values({
        tenantId,
        idFerramenta: input.idFerramenta,
        idFuncionarioRequisitante: requisitanteId,
        idFuncionarioResponsavel: prest.idFuncionario,
        idOrcamento: null, // sem orçamento (regra 11)
      })
      .returning();

    await tx
      .update(ferramentas)
      .set({ status: "em_reparo", updatedAt: new Date() })
      .where(eq(ferramentas.id, input.idFerramenta));

    return { tipo: "interno", reparo };
  });
}

// Concluir o reparo em aberto da ferramenta → aguardando_devolucao.
export async function concluirReparo(
  tenantId: string,
  input: { idFerramenta: string; descricaoReparoRealizado?: string | null },
) {
  return withTenant(tenantId, async (tx) => {
    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(and(eq(ferramentas.id, input.idFerramenta), isNull(ferramentas.deletedAt)))
      .limit(1);
    if (!fer) throw new AppError(404, "ferramenta não encontrada");
    if (fer.status !== "em_reparo") throw new AppError(409, "ferramenta não está em reparo");
    assertTransition("em_reparo", "aguardando_devolucao");

    const agora = new Date();
    const desc = input.descricaoReparoRealizado ?? null;

    const [ri] = await tx
      .select({ id: reparosInternos.id })
      .from(reparosInternos)
      .where(
        and(
          eq(reparosInternos.idFerramenta, input.idFerramenta),
          isNull(reparosInternos.dataFim),
          isNull(reparosInternos.canceledAt),
        ),
      )
      .limit(1);

    let reparo;
    if (ri) {
      [reparo] = await tx
        .update(reparosInternos)
        .set({ dataFim: agora, descricaoReparoRealizado: desc, updatedAt: agora })
        .where(eq(reparosInternos.id, ri.id))
        .returning();
    } else {
      const [re] = await tx
        .select({ id: reparosExternos.id })
        .from(reparosExternos)
        .where(
          and(
            eq(reparosExternos.idFerramenta, input.idFerramenta),
            isNull(reparosExternos.dataFim),
            isNull(reparosExternos.canceledAt),
          ),
        )
        .limit(1);
      if (!re) throw new AppError(409, "nenhum reparo em aberto para esta ferramenta");
      [reparo] = await tx
        .update(reparosExternos)
        .set({ dataFim: agora, descricaoReparoRealizado: desc, updatedAt: agora })
        .where(eq(reparosExternos.id, re.id))
        .returning();
    }

    await tx
      .update(ferramentas)
      .set({ status: "aguardando_devolucao", updatedAt: agora })
      .where(eq(ferramentas.id, input.idFerramenta));

    return { tipo: ri ? "interno" : "externo", reparo };
  });
}

// Lista reparos (internos + externos) do tenant, opcionalmente por ferramenta.
export async function listReparos(tenantId: string, idFerramenta?: string) {
  return withTenant(tenantId, async (tx) => {
    const internos = await tx
      .select()
      .from(reparosInternos)
      .where(idFerramenta ? eq(reparosInternos.idFerramenta, idFerramenta) : undefined);
    const externos = await tx
      .select()
      .from(reparosExternos)
      .where(idFerramenta ? eq(reparosExternos.idFerramenta, idFerramenta) : undefined);
    return [
      ...internos.map((r) => ({ tipo: "interno" as const, ...r })),
      ...externos.map((r) => ({ tipo: "externo" as const, ...r })),
    ];
  });
}
