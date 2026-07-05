/**
 * Finalidade: máquina de estados do status da Ferramenta (CLAUDE.md 4.6).
 * Como funciona: declara as transições válidas; assertTransition rejeita qualquer
 *   transição não listada. "Sucatear" (→ sucateada) é permitido de qualquer estado
 *   exceto `alugada` e do próprio `sucateada` (terminal).
 * Relações: usado por ferramentaService (ações de status) e, nos Sprints 5/6, pelos
 *   fluxos de empréstimo e reparo. Documentação: .claude/skills/skill-status-machine-ferramenta.md.
 */
import { toolStatusEnum } from "../db/schema/index";
import { AppError } from "../http/middleware/errors";

export type ToolStatus = (typeof toolStatusEnum.enumValues)[number];

// Transições válidas a partir de cada estado (inclui → sucateada onde permitido).
const TRANSITIONS: Record<ToolStatus, ToolStatus[]> = {
  disponivel: ["alugada", "aguardando_orcamento", "sucateada"],
  alugada: ["disponivel"], // não pode ser sucateada enquanto alugada
  // em_reparo direto: reparo interno sem orçamento (regra 11 / skill-status-machine).
  aguardando_orcamento: ["aguardando_liberacao", "em_reparo", "sucateada"],
  aguardando_liberacao: ["em_reparo", "aguardando_orcamento", "sucateada"],
  em_reparo: ["aguardando_devolucao", "sucateada"],
  aguardando_devolucao: ["disponivel", "sucateada"],
  sucateada: [], // estado terminal
};

export function canTransition(from: ToolStatus, to: ToolStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// Lança 409 se a transição não for permitida pela máquina de estados.
export function assertTransition(from: ToolStatus, to: ToolStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(409, `transição de status inválida: ${from} → ${to}`);
  }
}

// Uma ferramenta pode ser sucateada de qualquer estado, exceto quando alugada.
export function canScrap(from: ToolStatus): boolean {
  return from !== "alugada" && from !== "sucateada";
}
