/**
 * Finalidade: tela Cadastrar — CRUD de Funcionário e Prestador com busca por nome.
 * Como funciona: formulários (criar/editar) + tabelas com busca e ações. Promover a
 *   almoxarife é exclusivo do Root (pede a senha). Todos os campos/botões têm tooltip.
 * Relações: usa api/client, tipos e AuthContext (para exibir a promoção só ao Root).
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Funcionario, Prestador } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Banner, Button, Card, Field, useAsync } from "../components/ui";

export function CadastrarPage() {
  const { claims } = useAuth();
  const { error, success, setError, setSuccess, run } = useAsync();

  const [funcs, setFuncs] = useState<Funcionario[]>([]);
  const [prests, setPrests] = useState<Prestador[]>([]);
  const [buscaF, setBuscaF] = useState("");
  const [buscaP, setBuscaP] = useState("");

  const [f, setF] = useState({ id: "", nome: "", numeroTelefone: "", cpf: "", email: "", dataAdmissao: "" });
  const [p, setP] = useState({ id: "", nome: "", endereco: "", telefone: "", idFuncionario: "" });

  const loadFuncs = useCallback(async (s: string) => {
    setFuncs(await api.get<Funcionario[]>(`/funcionarios${s ? `?search=${encodeURIComponent(s)}` : ""}`));
  }, []);
  const loadPrests = useCallback(async (s: string) => {
    setPrests(await api.get<Prestador[]>(`/prestadores${s ? `?search=${encodeURIComponent(s)}` : ""}`));
  }, []);

  useEffect(() => {
    loadFuncs("").catch((e) => setError(e.message));
    loadPrests("").catch(() => {});
  }, [loadFuncs, loadPrests, setError]);

  const resetF = () => setF({ id: "", nome: "", numeroTelefone: "", cpf: "", email: "", dataAdmissao: "" });
  const resetP = () => setP({ id: "", nome: "", endereco: "", telefone: "", idFuncionario: "" });

  function papel(x: Funcionario) {
    return x.isRoot ? "Root" : x.statusAlmoxarife ? "Almoxarife" : "Depositário";
  }

  return (
    <div>
      <h2>Cadastrar</h2>
      <Banner kind="error">{error}</Banner>
      <Banner kind="success">{success}</Banner>

      {/* ---------------- Funcionários ---------------- */}
      <Card title={f.id ? "Editar funcionário" : "Novo funcionário"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const body = {
                nome: f.nome,
                numeroTelefone: f.numeroTelefone,
                cpf: f.cpf || null,
                email: f.email || null,
                dataAdmissao: f.dataAdmissao || null,
              };
              if (f.id) await api.patch(`/funcionarios/${f.id}`, body);
              else await api.post("/funcionarios", body);
              resetF();
              await loadFuncs(buscaF);
            }, "Funcionário salvo");
          }}
        >
          <div className="row">
            <Field label="Nome" title="Nome do funcionário" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
            <Field label="Telefone" title="Telefone único (com DDD). Vira login se promovido a almoxarife" value={f.numeroTelefone} onChange={(e) => setF({ ...f, numeroTelefone: e.target.value })} required />
            <Field label="CPF" title="CPF (opcional)" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} />
            <Field label="E-mail" title="E-mail (opcional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <Field label="Admissão" title="Data de admissão (opcional)" type="date" value={f.dataAdmissao} onChange={(e) => setF({ ...f, dataAdmissao: e.target.value })} />
          </div>
          <Button title="Salvar o funcionário" type="submit">{f.id ? "Salvar alterações" : "Cadastrar funcionário"}</Button>{" "}
          {f.id && <Button title="Cancelar a edição" type="button" variant="secondary" onClick={resetF}>Cancelar</Button>}
        </form>
      </Card>

      <Card title="Funcionários">
        <div className="row tight" style={{ marginBottom: 12 }}>
          <input title="Buscar funcionário por nome" placeholder="Buscar por nome…" value={buscaF} onChange={(e) => setBuscaF(e.target.value)} style={{ maxWidth: 260 }} />
          <Button title="Aplicar a busca" variant="secondary" onClick={() => run(() => loadFuncs(buscaF))}>Buscar</Button>
        </div>
        <table>
          <thead><tr><th>Nome</th><th>Telefone</th><th>Papel</th><th>Ações</th></tr></thead>
          <tbody>
            {funcs.map((x) => (
              <tr key={x.id}>
                <td>{x.nome}</td>
                <td>{x.numeroTelefone}</td>
                <td><span className="badge">{papel(x)}</span></td>
                <td>
                  <Button title="Editar os dados deste funcionário" variant="small" onClick={() => setF({ id: x.id, nome: x.nome, numeroTelefone: x.numeroTelefone, cpf: x.cpf ?? "", email: x.email ?? "", dataAdmissao: x.dataAdmissao ?? "" })}>Editar</Button>{" "}
                  {claims?.isRoot && !x.statusAlmoxarife && (
                    <Button title="Promover a almoxarife (define uma senha de acesso)" variant="small" onClick={() => run(async () => {
                      const senha = window.prompt("Defina a senha do novo almoxarife (mín. 6 caracteres):");
                      if (!senha) return;
                      await api.post(`/funcionarios/${x.id}/promover`, { senha });
                      await loadFuncs(buscaF);
                    }, "Funcionário promovido")}>Promover</Button>
                  )}{" "}
                  <Button title="Excluir (soft-delete) este funcionário" variant="small" onClick={() => run(async () => {
                    if (!window.confirm(`Excluir ${x.nome}?`)) return;
                    await api.del(`/funcionarios/${x.id}`);
                    await loadFuncs(buscaF);
                  }, "Funcionário excluído")}>Excluir</Button>
                </td>
              </tr>
            ))}
            {funcs.length === 0 && <tr><td colSpan={4} className="muted">Nenhum funcionário.</td></tr>}
          </tbody>
        </table>
      </Card>

      {/* ---------------- Prestadores ---------------- */}
      <Card title={p.id ? "Editar prestador" : "Novo prestador"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const body = {
                nome: p.nome,
                endereco: p.endereco || null,
                telefone: p.telefone || null,
                idFuncionario: p.idFuncionario || null,
              };
              if (p.id) await api.patch(`/prestadores/${p.id}`, body);
              else await api.post("/prestadores", body);
              resetP();
              await loadPrests(buscaP);
            }, "Prestador salvo");
          }}
        >
          <div className="row">
            <Field label="Nome" title="Nome do prestador de serviço" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} required />
            <Field label="Endereço" title="Endereço (opcional)" value={p.endereco} onChange={(e) => setP({ ...p, endereco: e.target.value })} />
            <Field label="Telefone" title="Telefone (opcional)" value={p.telefone} onChange={(e) => setP({ ...p, telefone: e.target.value })} />
            <div>
              <label title="Se for um funcionário interno, o reparo é roteado como interno">Funcionário interno</label>
              <select title="Vincular a um funcionário torna o prestador interno (roteamento de reparo)" value={p.idFuncionario} onChange={(e) => setP({ ...p, idFuncionario: e.target.value })}>
                <option value="">— externo —</option>
                {funcs.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </div>
          </div>
          <Button title="Salvar o prestador" type="submit">{p.id ? "Salvar alterações" : "Cadastrar prestador"}</Button>{" "}
          {p.id && <Button title="Cancelar a edição" type="button" variant="secondary" onClick={resetP}>Cancelar</Button>}
        </form>
      </Card>

      <Card title="Prestadores">
        <div className="row tight" style={{ marginBottom: 12 }}>
          <input title="Buscar prestador por nome" placeholder="Buscar por nome…" value={buscaP} onChange={(e) => setBuscaP(e.target.value)} style={{ maxWidth: 260 }} />
          <Button title="Aplicar a busca" variant="secondary" onClick={() => run(() => loadPrests(buscaP))}>Buscar</Button>
        </div>
        <table>
          <thead><tr><th>Nome</th><th>Telefone</th><th>Tipo</th><th>Ações</th></tr></thead>
          <tbody>
            {prests.map((x) => (
              <tr key={x.id}>
                <td>{x.nome}</td>
                <td>{x.telefone ?? "—"}</td>
                <td><span className="badge">{x.idFuncionario ? "Interno" : "Externo"}</span></td>
                <td>
                  <Button title="Editar este prestador" variant="small" onClick={() => setP({ id: x.id, nome: x.nome, endereco: x.endereco ?? "", telefone: x.telefone ?? "", idFuncionario: x.idFuncionario ?? "" })}>Editar</Button>{" "}
                  <Button title="Excluir (soft-delete) este prestador" variant="small" onClick={() => run(async () => {
                    if (!window.confirm(`Excluir ${x.nome}?`)) return;
                    await api.del(`/prestadores/${x.id}`);
                    await loadPrests(buscaP);
                  }, "Prestador excluído")}>Excluir</Button>
                </td>
              </tr>
            ))}
            {prests.length === 0 && <tr><td colSpan={4} className="muted">Nenhum prestador.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
