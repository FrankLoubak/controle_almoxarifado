/**
 * Finalidade: teste da tela de Relatórios (Sprint 8) — carrega catálogo, gera e renderiza.
 * Como funciona: mocka a API (catálogo + linhas) e verifica que a tabela dinâmica exibe os
 *   dados após "Gerar".
 * Relações: exercita RelatoriosPage e api/client.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RelatoriosPage } from "../pages/RelatoriosPage";

function json(body: unknown, status = 200) {
  return { ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body } as Response;
}

beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace("/api", "").split("?")[0];
    if (path === "/relatorios") return json([{ key: "disponiveis", label: "Ferramentas disponíveis", usaPeriodo: false }]);
    if (path === "/relatorios/disponiveis") return json([{ tipo: "furadeira", marca: "Bosch" }]);
    return json({ erro: "não mockado" }, 404);
  }) as unknown as typeof fetch;
});

describe("Tela de Relatórios", () => {
  it("gera e exibe os dados na tabela", async () => {
    const user = userEvent.setup();
    render(<RelatoriosPage />);
    await waitFor(() => expect(screen.getByRole("option", { name: "Ferramentas disponíveis" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Gerar" }));
    await waitFor(() => expect(screen.getByText("furadeira")).toBeInTheDocument());
    expect(screen.getByText("Bosch")).toBeInTheDocument();
  });
});
