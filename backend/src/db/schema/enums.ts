/**
 * Finalidade: enums PostgreSQL do domínio (status de ferramenta, orçamento, plano, etc.).
 * Como funciona: cada pgEnum vira um tipo no banco; as tabelas referenciam esses tipos.
 * Relações: consumido por tables.ts; o toolStatusEnum implementa a máquina de estados
 *   documentada em .claude/skills/skill-status-machine-ferramenta.md.
 */
import { pgEnum } from "drizzle-orm/pg-core";

// Status da ferramenta (CLAUDE.md 4.6 — validado literalmente pelo usuário).
export const toolStatusEnum = pgEnum("tool_status", [
  "disponivel",
  "alugada",
  "aguardando_orcamento",
  "aguardando_liberacao",
  "em_reparo",
  "aguardando_devolucao",
  "sucateada",
]);

// Status do orçamento (CLAUDE.md 4.9).
export const orcamentoStatusEnum = pgEnum("orcamento_status", [
  "pendente",
  "liberado",
  "recusado",
]);

// Tipo de reparo — derivado de Prestador.id_funcionario (CLAUDE.md 4.9).
export const tipoReparoEnum = pgEnum("tipo_reparo", ["externo", "interno"]);

// Plano de assinatura (CLAUDE.md 5.4).
export const planoEnum = pgEnum("plano_assinatura", ["mensal", "anual"]);

// Status da assinatura/pagamento do tenant (CLAUDE.md 5.2/5.4).
export const assinaturaStatusEnum = pgEnum("assinatura_status", [
  "regular",
  "atrasado",
  "cancelado",
]);
