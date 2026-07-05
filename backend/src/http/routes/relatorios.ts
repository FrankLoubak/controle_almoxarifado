/**
 * Finalidade: rotas REST dos relatórios (seção 7). GET /relatorios lista o catálogo;
 *   GET /relatorios/:nome?inicio&fim retorna as linhas do relatório (tenant-scoped/RLS).
 * Como funciona: exige almoxarife autenticado; um registry mapeia a chave do relatório à
 *   função do relatorioService. O período é opcional (inicio/fim em YYYY-MM-DD).
 * Relações: montada em app.ts sob authenticate; usa authorize e relatorioService.
 */
import { Router } from "express";
import {
  diasPorFerramenta,
  emprestimosAbertosPorFuncionario,
  ferramentasAlugadas,
  ferramentasDisponiveis,
  ferramentasEmReparo,
  ferramentasSucateadas,
  gastoReparosPorFerramenta,
  orcamentosPorFerramenta,
  type Periodo,
} from "../../services/relatorioService";
import { getTenantId, requireAlmoxarife } from "../middleware/authorize";
import { AppError, asyncHandler } from "../middleware/errors";

type Rows = Record<string, unknown>[];
interface Relatorio {
  label: string;
  usaPeriodo: boolean;
  run: (tenantId: string, p: Periodo) => Promise<Rows>;
}

const REGISTRY: Record<string, Relatorio> = {
  disponiveis: { label: "Ferramentas disponíveis", usaPeriodo: false, run: (t) => ferramentasDisponiveis(t) },
  alugadas: { label: "Ferramentas alugadas (dias decorridos)", usaPeriodo: true, run: ferramentasAlugadas },
  orcamentos: { label: "Orçamentos por ferramenta", usaPeriodo: true, run: orcamentosPorFerramenta },
  "em-reparo": { label: "Em reparo e aguardando devolução", usaPeriodo: false, run: (t) => ferramentasEmReparo(t) },
  "gasto-reparos": { label: "Valor gasto em reparos por ferramenta", usaPeriodo: true, run: gastoReparosPorFerramenta },
  sucateadas: { label: "Ferramentas sucateadas", usaPeriodo: false, run: (t) => ferramentasSucateadas(t) },
  dias: { label: "Dias de empréstimo e reparo por ferramenta", usaPeriodo: true, run: diasPorFerramenta },
  "emprestimos-abertos": { label: "Empréstimos em aberto por funcionário", usaPeriodo: true, run: emprestimosAbertosPorFuncionario },
};

export function relatoriosRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  // Catálogo de relatórios (para montar o menu no frontend).
  router.get("/", (_req, res) => {
    res.json(Object.entries(REGISTRY).map(([key, r]) => ({ key, label: r.label, usaPeriodo: r.usaPeriodo })));
  });

  router.get(
    "/:nome",
    asyncHandler(async (req, res) => {
      const rel = REGISTRY[String(req.params.nome)];
      if (!rel) throw new AppError(404, "relatório não encontrado");
      const inicio = typeof req.query.inicio === "string" ? req.query.inicio : undefined;
      const fim = typeof req.query.fim === "string" ? req.query.fim : undefined;
      res.json(await rel.run(getTenantId(req), { inicio, fim }));
    }),
  );

  return router;
}
