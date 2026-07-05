/**
 * Finalidade: consultas dos 8 relatórios da seção 7 (CLAUDE.md), com filtro por período.
 * Como funciona: cada função roda com o tenant fixado (withTenant → RLS) e usa SQL para
 *   agregações (dias decorridos, somas). O período (inicio/fim) filtra a data relevante de
 *   cada relatório; em relatórios de "estado atual" (disponíveis, sucateadas, em reparo) o
 *   período não se aplica. Datas em America/Sao_Paulo são derivadas de timestamptz (UTC).
 * Relações: usado por routes/relatorios; frontend exporta os resultados em CSV.
 */
import { sql, type SQL } from "drizzle-orm";
import { withTenant } from "../db/client";

export interface Periodo {
  inicio?: string; // YYYY-MM-DD
  fim?: string; // YYYY-MM-DD (inclusivo)
}

// Condição de período sobre uma coluna (ambos os limites obrigatórios para aplicar).
function periodo(col: string, p: Periodo): SQL {
  if (!p.inicio || !p.fim) return sql``;
  return sql` AND ${sql.raw(col)} >= ${p.inicio}::date AND ${sql.raw(col)} < (${p.fim}::date + 1)`;
}

type Rows = Record<string, unknown>[];
async function query(tenantId: string, q: SQL): Promise<Rows> {
  return withTenant(tenantId, async (tx) => {
    const res = await tx.execute(q);
    return res.rows as Rows;
  });
}

// 1) Ferramentas disponíveis (estado atual).
export function ferramentasDisponiveis(tenantId: string) {
  return query(
    tenantId,
    sql`SELECT id, tipo, marca, descricao FROM ferramentas
        WHERE status = 'disponivel' AND deleted_at IS NULL ORDER BY tipo`,
  );
}

// 2) Ferramentas alugadas + dias decorridos desde o início do aluguel.
export function ferramentasAlugadas(tenantId: string, p: Periodo) {
  return query(
    tenantId,
    sql`SELECT f.id, f.tipo, f.marca, e.data_saida,
          FLOOR(EXTRACT(EPOCH FROM (now() - e.data_saida)) / 86400)::int AS dias
        FROM ferramentas f
        JOIN emprestimos e ON e.id_ferramenta = f.id AND e.data_retorno IS NULL
        WHERE f.status = 'alugada'${periodo("e.data_saida", p)}
        ORDER BY dias DESC`,
  );
}

// 3) Orçamentos (aguardando/pendente, recusado ou liberado) por ferramenta.
export function orcamentosPorFerramenta(tenantId: string, p: Periodo) {
  return query(
    tenantId,
    sql`SELECT o.id, f.tipo, f.marca, o.tipo_reparo, o.valor_orcamento, o.status, o.data_cadastro
        FROM orcamentos o JOIN ferramentas f ON f.id = o.id_ferramenta
        WHERE o.canceled_at IS NULL${periodo("o.data_cadastro", p)}
        ORDER BY o.data_cadastro DESC`,
  );
}

// 4) Ferramentas em reparo e aguardando devolução (estado atual).
export function ferramentasEmReparo(tenantId: string) {
  return query(
    tenantId,
    sql`SELECT id, tipo, marca, status FROM ferramentas
        WHERE status IN ('em_reparo', 'aguardando_devolucao') AND deleted_at IS NULL
        ORDER BY status, tipo`,
  );
}

// 5) Valor total gasto em reparos (orçamentos liberados) por ferramenta.
export function gastoReparosPorFerramenta(tenantId: string, p: Periodo) {
  return query(
    tenantId,
    sql`SELECT f.id, f.tipo, f.marca, COALESCE(SUM(o.valor_orcamento), 0) AS total
        FROM ferramentas f
        JOIN orcamentos o ON o.id_ferramenta = f.id AND o.status = 'liberado' AND o.canceled_at IS NULL
        WHERE true${periodo("o.data_cadastro", p)}
        GROUP BY f.id, f.tipo, f.marca
        ORDER BY total DESC`,
  );
}

// 6) Ferramentas sucateadas (estado atual).
export function ferramentasSucateadas(tenantId: string) {
  return query(
    tenantId,
    sql`SELECT id, tipo, marca FROM ferramentas
        WHERE status = 'sucateada' AND deleted_at IS NULL ORDER BY tipo`,
  );
}

// 7) Dias totais de empréstimo e de reparo por ferramenta.
export function diasPorFerramenta(tenantId: string, p: Periodo) {
  return query(
    tenantId,
    sql`SELECT f.id, f.tipo, f.marca,
          COALESCE(ROUND((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(e.data_retorno, now()) - e.data_saida)) / 86400)
            FROM emprestimos e WHERE e.id_ferramenta = f.id${periodo("e.data_saida", p)}))::int, 0) AS dias_emprestimo,
          COALESCE(ROUND((SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(r.data_fim, now()) - r.data_inicio)) / 86400)
            FROM (
              SELECT id_ferramenta, data_inicio, data_fim FROM reparos_externos WHERE canceled_at IS NULL
              UNION ALL
              SELECT id_ferramenta, data_inicio, data_fim FROM reparos_internos WHERE canceled_at IS NULL
            ) r WHERE r.id_ferramenta = f.id${periodo("r.data_inicio", p)}))::int, 0) AS dias_reparo
        FROM ferramentas f WHERE f.deleted_at IS NULL
        ORDER BY f.tipo`,
  );
}

// 8) Empréstimos em aberto, agrupados por funcionário (depositário).
export function emprestimosAbertosPorFuncionario(tenantId: string, p: Periodo) {
  return query(
    tenantId,
    sql`SELECT fu.id AS funcionario_id, fu.nome, COUNT(*)::int AS qtd,
          string_agg(f.tipo, ', ') AS ferramentas
        FROM emprestimos e
        JOIN funcionarios fu ON fu.id = e.id_depositario
        JOIN ferramentas f ON f.id = e.id_ferramenta
        WHERE e.data_retorno IS NULL${periodo("e.data_saida", p)}
        GROUP BY fu.id, fu.nome ORDER BY qtd DESC`,
  );
}
