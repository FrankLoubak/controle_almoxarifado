/**
 * Finalidade: regras de negócio do Empréstimo (realizar/encerrar) — CLAUDE.md 4.5/5.1.
 * Como funciona: cada operação roda numa transação com o tenant fixado (RLS). Realizar
 *   exige ferramenta `disponivel` (regra 8) e depositário válido (regra 2); grava o
 *   empréstimo e move a ferramenta para `alugada`. Encerrar só vale para empréstimo ativo
 *   (regra 14) e devolve a ferramenta para `disponivel` (regra 16). O emprestador é o
 *   almoxarife autenticado (regra 3). A unicidade de empréstimo ativo por ferramenta
 *   (regra 1) é garantida pelo índice parcial `uq_emprestimo_ferramenta_ativo`.
 * Relações: usado por routes/emprestimos; usa db/client, schema e toolStatusMachine.
 */
import { and, eq, isNull } from "drizzle-orm";
import { withTenant } from "../db/client";
import { emprestimos, ferramentas, funcionarios } from "../db/schema/index";
import { assertTransition } from "../domain/toolStatusMachine";
import { AppError } from "../http/middleware/errors";

const publicCols = {
  id: emprestimos.id,
  idFerramenta: emprestimos.idFerramenta,
  idDepositario: emprestimos.idDepositario,
  idFuncionarioEmprestador: emprestimos.idFuncionarioEmprestador,
  dataSaida: emprestimos.dataSaida,
  dataRetorno: emprestimos.dataRetorno,
};

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505";
}

export interface RealizarEmprestimoInput {
  idFerramenta: string;
  idDepositario: string;
}

export async function realizarEmprestimo(
  tenantId: string,
  emprestadorId: string,
  input: RealizarEmprestimoInput,
) {
  return withTenant(tenantId, async (tx) => {
    // Depositário deve ser funcionário cadastrado (regra 2).
    const [dep] = await tx
      .select({ id: funcionarios.id })
      .from(funcionarios)
      .where(and(eq(funcionarios.id, input.idDepositario), isNull(funcionarios.deletedAt)))
      .limit(1);
    if (!dep) throw new AppError(400, "depositário inválido para este tenant");

    // Ferramenta deve existir e estar disponível (regra 8).
    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(and(eq(ferramentas.id, input.idFerramenta), isNull(ferramentas.deletedAt)))
      .limit(1);
    if (!fer) throw new AppError(404, "ferramenta não encontrada");
    if (fer.status !== "disponivel") {
      throw new AppError(409, "ferramenta indisponível para empréstimo");
    }
    assertTransition("disponivel", "alugada");

    let loan;
    try {
      [loan] = await tx
        .insert(emprestimos)
        .values({
          tenantId,
          idFerramenta: input.idFerramenta,
          idDepositario: input.idDepositario,
          idFuncionarioEmprestador: emprestadorId,
        })
        .returning(publicCols);
    } catch (err) {
      // Índice parcial garante um único empréstimo ativo por ferramenta (regra 1).
      if (isUniqueViolation(err)) throw new AppError(409, "ferramenta já possui empréstimo ativo");
      throw err;
    }

    await tx
      .update(ferramentas)
      .set({ status: "alugada", updatedAt: new Date() })
      .where(eq(ferramentas.id, input.idFerramenta));

    return loan;
  });
}

export async function encerrarEmprestimo(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const [loan] = await tx
      .select({ id: emprestimos.id, idFerramenta: emprestimos.idFerramenta, dataRetorno: emprestimos.dataRetorno })
      .from(emprestimos)
      .where(eq(emprestimos.id, id))
      .limit(1);
    if (!loan) throw new AppError(404, "empréstimo não encontrado");
    if (loan.dataRetorno) throw new AppError(409, "empréstimo já encerrado"); // regra 14

    // Devolve a ferramenta para disponível (regra 16).
    const [fer] = await tx
      .select({ status: ferramentas.status })
      .from(ferramentas)
      .where(eq(ferramentas.id, loan.idFerramenta))
      .limit(1);
    if (fer) assertTransition(fer.status, "disponivel");

    const [updated] = await tx
      .update(emprestimos)
      .set({ dataRetorno: new Date(), updatedAt: new Date() })
      .where(eq(emprestimos.id, id))
      .returning(publicCols);

    await tx
      .update(ferramentas)
      .set({ status: "disponivel", updatedAt: new Date() })
      .where(eq(ferramentas.id, loan.idFerramenta));

    return updated;
  });
}

export interface ListEmprestimosFilter {
  ativo?: boolean;
  idDepositario?: string;
  idFerramenta?: string;
}

export async function listEmprestimos(tenantId: string, filter: ListEmprestimosFilter = {}) {
  return withTenant(tenantId, (tx) => {
    const filters = [];
    if (filter.ativo === true) filters.push(isNull(emprestimos.dataRetorno));
    if (filter.idDepositario) filters.push(eq(emprestimos.idDepositario, filter.idDepositario));
    if (filter.idFerramenta) filters.push(eq(emprestimos.idFerramenta, filter.idFerramenta));
    const q = tx.select(publicCols).from(emprestimos);
    return filters.length ? q.where(and(...filters)) : q;
  });
}

export async function getEmprestimo(tenantId: string, id: string) {
  const [row] = await withTenant(tenantId, (tx) =>
    tx.select(publicCols).from(emprestimos).where(eq(emprestimos.id, id)).limit(1),
  );
  if (!row) throw new AppError(404, "empréstimo não encontrado");
  return row;
}
