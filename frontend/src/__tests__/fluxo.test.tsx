/**
 * Finalidade: teste de integração do fluxo crítico (Sprint 7) — login → 2FA → operação.
 * Como funciona: renderiza o App com a API mockada (fetch), passa pelo login em 2 passos,
 *   entra na tela Ferramentas e cadastra uma ferramenta, verificando que ela aparece.
 * Relações: exercita App, AuthContext, api/client e as páginas Login/Ferramentas.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { setAccessToken } from "../api/client";

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

let ferramentas: Array<Record<string, unknown>>;

beforeEach(() => {
  setAccessToken(null);
  ferramentas = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace("/api", "").split("?")[0];
    const method = init?.method ?? "GET";
    if (path === "/auth/refresh") return json({ erro: "sem sessão" }, 401);
    if (path === "/auth/login") return json({ challengeId: "ch1" });
    if (path === "/auth/verify-otp") return json({ accessToken: "tok" });
    if (path === "/auth/me")
      return json({ auth: { sub: "u1", type: "funcionario", tenantId: "t1", isRoot: true, isAlmoxarife: true } });
    if (path === "/prestadores") return json([]);
    if (path === "/funcionarios" || path === "/emprestimos") return json([]);
    if (path.startsWith("/orcamentos")) return json([]);
    if (path === "/ferramentas" && method === "GET") return json(ferramentas);
    if (path === "/ferramentas" && method === "POST") {
      const b = JSON.parse(String(init?.body));
      const f = { id: "f1", tipo: b.tipo, marca: b.marca, descricao: b.descricao, status: "disponivel" };
      ferramentas = [...ferramentas, f];
      return json(f, 201);
    }
    if (path.startsWith("/ferramentas/")) return json(ferramentas[0] ?? null);
    return json({ erro: `não mockado: ${path}` }, 404);
  }) as unknown as typeof fetch;
});

describe("Fluxo crítico login → 2FA → cadastrar ferramenta", () => {
  it("autentica e cria uma ferramenta que aparece na lista", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Passo 1: telefone + senha.
    const entrar = await screen.findByRole("button", { name: "Entrar" });
    await user.type(screen.getByPlaceholderText("+55119..."), "+5511999990000");
    await user.type(screen.getByLabelText("Senha"), "Senha@123");
    await user.click(entrar);

    // Passo 2: código OTP.
    const verificar = await screen.findByRole("button", { name: "Verificar" });
    await user.type(screen.getByPlaceholderText("000000"), "123456");
    await user.click(verificar);

    // Autenticado: chega na home.
    await screen.findByText("Bem-vindo");

    // Navega para Ferramentas e cadastra uma.
    await user.click(screen.getByRole("link", { name: "Ferramentas" }));
    await screen.findByRole("button", { name: "Cadastrar ferramenta" });
    await user.type(screen.getByLabelText("Tipo"), "furadeira");
    await user.click(screen.getByRole("button", { name: "Cadastrar ferramenta" }));

    // A ferramenta cadastrada aparece na tabela.
    await waitFor(() => {
      const tabela = screen.getAllByRole("table")[0];
      expect(within(tabela).getByText("furadeira")).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
