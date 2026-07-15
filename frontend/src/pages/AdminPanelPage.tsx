/**
 * Finalidade: painel do super-admin — gestão de empresas-cliente (tenants).
 * Como funciona: lista as empresas, faz onboarding (empresa + Root inicial) e ativa/
 *   desativa contas. Os campos vêm da função SQL (snake_case).
 * Relações: usa api/client; endpoints /admin/tenants.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { Banner, Button, Card, Field, useAsync } from "../components/ui";

interface TenantRow {
  id: string;
  razao_social: string;
  cnpj: string;
  email: string;
  telefone: string;
  ativo: boolean;
  status_assinatura: string;
}

export function AdminPanelPage() {
  const { error, success, setError, run } = useAsync();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [f, setF] = useState({ razaoSocial: "", cnpj: "", email: "", telefone: "", endereco: "", rootNome: "", rootTelefone: "", rootSenha: "" });

  const load = useCallback(() => run(async () => setTenants(await api.get<TenantRow[]>("/admin/tenants"))), [run]);
  useEffect(() => {
    api.get<TenantRow[]>("/admin/tenants").then(setTenants).catch((e) => setError(e.message));
  }, [setError]);

  const reset = () => setF({ razaoSocial: "", cnpj: "", email: "", telefone: "", endereco: "", rootNome: "", rootTelefone: "", rootSenha: "" });

  return (
    <div>
      <h2>Empresas</h2>
      <Banner kind="error">{error}</Banner>
      <Banner kind="success">{success}</Banner>

      <Card title="Nova empresa (onboarding)">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.post("/admin/tenants", {
                razaoSocial: f.razaoSocial,
                cnpj: f.cnpj,
                email: f.email,
                telefone: f.telefone,
                endereco: f.endereco || null,
                root: { nome: f.rootNome, telefone: f.rootTelefone, senha: f.rootSenha },
              });
              reset();
              await load();
            }, "Empresa criada");
          }}
        >
          <div className="row">
            <Field label="Razão social" title="Razão social da empresa-cliente" value={f.razaoSocial} onChange={(e) => setF({ ...f, razaoSocial: e.target.value })} required />
            <Field label="CNPJ" title="CNPJ da empresa (único)" value={f.cnpj} onChange={(e) => setF({ ...f, cnpj: e.target.value })} required />
            <Field label="E-mail" title="E-mail de contato/cobrança da empresa" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            <Field label="Telefone" title="Telefone da empresa" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} required />
            <Field label="Endereço" title="Endereço (opcional)" value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} />
          </div>
          <p className="muted">Root inicial da empresa (loga por telefone + senha + 2FA):</p>
          <div className="row">
            <Field label="Nome do Root" title="Nome do administrador (Root) da empresa" value={f.rootNome} onChange={(e) => setF({ ...f, rootNome: e.target.value })} required />
            <Field label="Telefone do Root" title="Telefone único do Root (login)" value={f.rootTelefone} onChange={(e) => setF({ ...f, rootTelefone: e.target.value })} required />
            <Field label="Senha inicial" title="Senha inicial do Root (ele troca depois; mín. 6)" type="password" value={f.rootSenha} onChange={(e) => setF({ ...f, rootSenha: e.target.value })} required />
          </div>
          <Button title="Criar a empresa e o Root inicial" type="submit">Criar empresa</Button>
        </form>
      </Card>

      <Card title="Empresas cadastradas">
        <table>
          <thead><tr><th>Razão social</th><th>CNPJ</th><th>Pagamento</th><th>Conta</th><th>Ações</th></tr></thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.razao_social}</td>
                <td>{t.cnpj}</td>
                <td><span className="badge">{t.status_assinatura}</span></td>
                <td><span className="badge">{t.ativo ? "ativa" : "desativada"}</span></td>
                <td>
                  {t.ativo ? (
                    <Button title="Desativar (bloqueia o acesso da empresa)" variant="danger" onClick={() => run(async () => { await api.patch(`/admin/tenants/${t.id}/desativar`); await load(); }, "Empresa desativada")}>Desativar</Button>
                  ) : (
                    <Button title="Reativar o acesso da empresa" variant="ok" onClick={() => run(async () => { await api.patch(`/admin/tenants/${t.id}/ativar`); await load(); }, "Empresa reativada")}>Ativar</Button>
                  )}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan={5} className="muted">Nenhuma empresa.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
