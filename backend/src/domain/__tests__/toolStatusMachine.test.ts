/**
 * Finalidade: teste unitário da máquina de estados da ferramenta (4.6) — fluxo crítico.
 * Como funciona: verifica transições válidas/ inválidas e a regra de sucateamento, sem DB.
 * Relações: cobre domain/toolStatusMachine.
 */
import { describe, expect, it } from "vitest";
import { assertTransition, canScrap, canTransition } from "../toolStatusMachine";

describe("toolStatusMachine", () => {
  it("aceita as transições válidas do fluxo de reparo", () => {
    expect(canTransition("disponivel", "aguardando_orcamento")).toBe(true);
    expect(canTransition("aguardando_orcamento", "aguardando_liberacao")).toBe(true);
    expect(canTransition("aguardando_liberacao", "em_reparo")).toBe(true);
    expect(canTransition("aguardando_liberacao", "aguardando_orcamento")).toBe(true);
    // Reparo interno sem orçamento (regra 11).
    expect(canTransition("aguardando_orcamento", "em_reparo")).toBe(true);
    expect(canTransition("em_reparo", "aguardando_devolucao")).toBe(true);
    expect(canTransition("aguardando_devolucao", "disponivel")).toBe(true);
    expect(canTransition("disponivel", "alugada")).toBe(true);
    expect(canTransition("alugada", "disponivel")).toBe(true);
  });

  it("rejeita transições inválidas", () => {
    expect(canTransition("disponivel", "em_reparo")).toBe(false);
    expect(canTransition("disponivel", "aguardando_devolucao")).toBe(false);
    expect(canTransition("alugada", "aguardando_orcamento")).toBe(false);
    expect(canTransition("sucateada", "disponivel")).toBe(false);
    expect(() => assertTransition("disponivel", "em_reparo")).toThrow();
  });

  it("sucatear é permitido de qualquer estado exceto alugada/sucateada", () => {
    expect(canScrap("disponivel")).toBe(true);
    expect(canScrap("aguardando_orcamento")).toBe(true);
    expect(canScrap("em_reparo")).toBe(true);
    expect(canScrap("aguardando_devolucao")).toBe(true);
    expect(canScrap("alugada")).toBe(false);
    expect(canScrap("sucateada")).toBe(false);
    expect(canTransition("alugada", "sucateada")).toBe(false);
  });
});
