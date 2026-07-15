/**
 * Finalidade: teste de integração do fluxo super-admin (Sprint 12) — login TOTP → painel.
 * Como funciona: API mockada; passa pelo login (e-mail+senha+TOTP), entra no painel de
 *   empresas e faz o onboarding de uma empresa, verificando que ela aparece na lista.
 * Relações: exercita App (roteamento por tipo), AuthContext e AdminPanelPage.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { setAccessToken } from "../api/client";

function json(body: unknown, status = 200) {
  return { ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body } as Response;
}

let tenants: Array<Record<string, unknown>>;

beforeEach(() => {
  setAccessToken(null);
  tenants = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace("/api", "").split("?")[0];
    const method = init?.method ?? "GET";
    if (path === "/auth/refresh") return json({ erro: "sem sessão" }, 401);
    if (path === "/auth/super-admin/login") return json({ preauthToken: "pre.1" });
    if (path === "/auth/super-admin/verify-totp") return json({ accessToken: "tok" });
    if (path === "/auth/me") return json({ auth: { sub: "sa1", type: "super_admin" } });
    if (path === "/admin/tenants" && method === "GET") return json(tenants);
    if (path === "/admin/tenants" && method === "POST") {
      const b = JSON.parse(String(init?.body));
      tenants = [...tenants, { id: "t1", razao_social: b.razaoSocial, cnpj: b.cnpj, email: b.email, telefone: b.telefone, ativo: true, status_assinatura: "regular" }];
      return json({ tenant_id: "t1", root_id: "r1" }, 201);
    }
    return json({ erro: `não mockado: ${path}` }, 404);
  }) as unknown as typeof fetch;
});

describe("Fluxo super-admin: login TOTP → painel → onboarding", () => {
  it("autentica e cadastra uma empresa que aparece na lista", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/login"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Passo 1: e-mail + senha.
    const entrar = await screen.findByRole("button", { name: "Entrar" });
    await user.type(screen.getByLabelText("E-mail"), "admin@plataforma.local");
    await user.type(screen.getByLabelText("Senha"), "Admin@123");
    await user.click(entrar);

    // Passo 2: TOTP.
    const verificar = await screen.findByRole("button", { name: "Verificar" });
    await user.type(screen.getByLabelText("Código TOTP"), "123456");
    await user.click(verificar);

    // Painel de empresas.
    await screen.findByRole("heading", { name: "Empresas" });

    // Onboarding.
    await user.type(screen.getByLabelText("Razão social"), "Acme LTDA");
    await user.type(screen.getByLabelText("CNPJ"), "00000000000191");
    await user.type(screen.getByLabelText("E-mail"), "contato@acme.local");
    await user.type(screen.getByLabelText("Telefone"), "+551130000000");
    await user.type(screen.getByLabelText("Nome do Root"), "Fulano");
    await user.type(screen.getByLabelText("Telefone do Root"), "+5511999998888");
    await user.type(screen.getByLabelText("Senha inicial"), "Root@123");
    await user.click(screen.getByRole("button", { name: "Criar empresa" }));

    await waitFor(() => {
      const tabela = screen.getAllByRole("table")[0];
      expect(within(tabela).getByText("Acme LTDA")).toBeInTheDocument();
    });
  });
});
