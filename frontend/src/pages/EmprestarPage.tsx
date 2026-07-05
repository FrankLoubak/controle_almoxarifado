/**
 * Finalidade: tela Emprestar — realizar e encerrar empréstimos.
 * Como funciona: seleciona uma ferramenta disponível e um depositário e realiza o
 *   empréstimo; lista os empréstimos ativos com opção de encerrar. Nomes resolvidos por
 *   mapas de ferramentas/funcionários.
 * Relações: usa api/client e tipos. Endpoints /emprestimos, /ferramentas, /funcionarios.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Emprestimo, Ferramenta, Funcionario } from "../api/types";
import { Banner, Button, Card, useAsync } from "../components/ui";

export function EmprestarPage() {
  const { error, success, setError, run } = useAsync();
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [ativos, setAtivos] = useState<Emprestimo[]>([]);
  const [idFerramenta, setIdFerramenta] = useState("");
  const [idDepositario, setIdDepositario] = useState("");

  const disponiveis = useMemo(() => ferramentas.filter((f) => f.status === "disponivel"), [ferramentas]);
  const ferMap = useMemo(() => new Map(ferramentas.map((f) => [f.id, f])), [ferramentas]);
  const funcMap = useMemo(() => new Map(funcionarios.map((f) => [f.id, f])), [funcionarios]);

  const load = useCallback(async () => {
    const [fers, funcs, act] = await Promise.all([
      api.get<Ferramenta[]>("/ferramentas"),
      api.get<Funcionario[]>("/funcionarios"),
      api.get<Emprestimo[]>("/emprestimos?ativo=true"),
    ]);
    setFerramentas(fers);
    setFuncionarios(funcs);
    setAtivos(act);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load, setError]);

  return (
    <div>
      <h2>Emprestar</h2>
      <Banner kind="error">{error}</Banner>
      <Banner kind="success">{success}</Banner>

      <Card title="Novo empréstimo">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api.post("/emprestimos", { idFerramenta, idDepositario });
              setIdFerramenta("");
              setIdDepositario("");
              await load();
            }, "Empréstimo realizado");
          }}
        >
          <div className="row">
            <div>
              <label title="Ferramenta disponível a ser emprestada">Ferramenta</label>
              <select title="Somente ferramentas com status Disponível" value={idFerramenta} onChange={(e) => setIdFerramenta(e.target.value)} required>
                <option value="">— selecione —</option>
                {disponiveis.map((f) => <option key={f.id} value={f.id}>{f.tipo}{f.marca ? ` · ${f.marca}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label title="Funcionário que ficará responsável pela ferramenta">Depositário</label>
              <select title="Qualquer funcionário cadastrado pode ser depositário" value={idDepositario} onChange={(e) => setIdDepositario(e.target.value)} required>
                <option value="">— selecione —</option>
                {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>
          <Button title="Registrar o empréstimo (você é o emprestador)" type="submit" disabled={!idFerramenta || !idDepositario}>Realizar empréstimo</Button>
        </form>
      </Card>

      <Card title="Empréstimos ativos">
        <table>
          <thead><tr><th>Ferramenta</th><th>Depositário</th><th>Saída</th><th>Ações</th></tr></thead>
          <tbody>
            {ativos.map((e) => {
              const fer = ferMap.get(e.idFerramenta);
              return (
                <tr key={e.id}>
                  <td>{fer ? `${fer.tipo}${fer.marca ? ` · ${fer.marca}` : ""}` : e.idFerramenta}</td>
                  <td>{funcMap.get(e.idDepositario)?.nome ?? e.idDepositario}</td>
                  <td>{new Date(e.dataSaida).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <Button title="Encerrar o empréstimo e devolver a ferramenta ao estoque" variant="small" onClick={() => run(async () => {
                      await api.post(`/emprestimos/${e.id}/encerrar`);
                      await load();
                    }, "Empréstimo encerrado")}>Encerrar</Button>
                  </td>
                </tr>
              );
            })}
            {ativos.length === 0 && <tr><td colSpan={4} className="muted">Nenhum empréstimo ativo.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
