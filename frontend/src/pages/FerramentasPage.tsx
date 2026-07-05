/**
 * Finalidade: tela Ferramentas — CRUD e todo o fluxo de reparo/orçamento (máquina de
 *   estados 4.6). As ações disponíveis mudam conforme o status da ferramenta selecionada.
 * Como funciona: lista/busca ferramentas; ao selecionar uma, mostra ações contextuais
 *   (enviar/retornar reparo, sucatear, cadastrar/liberar/recusar orçamento, reparo interno
 *   direto, concluir) e os orçamentos dela.
 * Relações: usa api/client e tipos; endpoints /ferramentas, /orcamentos, /reparos, /prestadores.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { STATUS_LABEL, type Ferramenta, type Orcamento, type Prestador } from "../api/types";
import { Banner, Button, Card, Field, useAsync } from "../components/ui";

export function FerramentasPage() {
  const async = useAsync();
  const { error, success, setError, run } = async;
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Ferramenta | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [form, setForm] = useState({ id: "", tipo: "", descricao: "", marca: "" });

  const loadFerramentas = useCallback(async (s: string) => {
    setFerramentas(await api.get<Ferramenta[]>(`/ferramentas${s ? `?search=${encodeURIComponent(s)}` : ""}`));
  }, []);
  const loadOrcamentos = useCallback(async (idFer: string) => {
    setOrcamentos(await api.get<Orcamento[]>(`/orcamentos?ferramenta=${idFer}`));
  }, []);

  useEffect(() => {
    loadFerramentas("").catch((e) => setError(e.message));
    api.get<Prestador[]>("/prestadores").then(setPrestadores).catch(() => {});
  }, [loadFerramentas, setError]);

  // Recarrega ferramentas + a seleção + os orçamentos dela após uma ação.
  const reload = useCallback(async () => {
    await loadFerramentas(busca);
    if (sel) {
      const atual = await api.get<Ferramenta>(`/ferramentas/${sel.id}`).catch(() => null);
      setSel(atual);
      if (atual) await loadOrcamentos(atual.id);
    }
  }, [busca, sel, loadFerramentas, loadOrcamentos]);

  const act = (fn: () => Promise<void>, ok: string) => run(async () => { await fn(); await reload(); }, ok);

  async function selecionar(f: Ferramenta) {
    setSel(f);
    await loadOrcamentos(f.id).catch(() => setOrcamentos([]));
  }

  const resetForm = () => setForm({ id: "", tipo: "", descricao: "", marca: "" });

  return (
    <div>
      <h2>Ferramentas</h2>
      <Banner kind="error">{error}</Banner>
      <Banner kind="success">{success}</Banner>

      <Card title={form.id ? "Editar ferramenta" : "Nova ferramenta"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const body = { tipo: form.tipo, descricao: form.descricao || null, marca: form.marca || null };
              if (form.id) await api.patch(`/ferramentas/${form.id}`, body);
              else await api.post("/ferramentas", body);
              resetForm();
              await loadFerramentas(busca);
            }, "Ferramenta salva");
          }}
        >
          <div className="row">
            <Field label="Tipo" title="Tipo da ferramenta (manual, elétrica, pneumática…)" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} required />
            <Field label="Marca" title="Marca (opcional)" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            <Field label="Descrição" title="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <Button title="Salvar a ferramenta" type="submit">{form.id ? "Salvar" : "Cadastrar ferramenta"}</Button>{" "}
          {form.id && <Button title="Cancelar a edição" type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>}
        </form>
      </Card>

      <Card title="Ferramentas">
        <div className="row tight" style={{ marginBottom: 12 }}>
          <input title="Buscar por tipo, marca ou descrição" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 260 }} />
          <Button title="Aplicar a busca" variant="secondary" onClick={() => run(() => loadFerramentas(busca))}>Buscar</Button>
        </div>
        <table>
          <thead><tr><th>Tipo</th><th>Marca</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {ferramentas.map((f) => (
              <tr key={f.id} style={sel?.id === f.id ? { background: "#eff6ff" } : undefined}>
                <td>{f.tipo}</td>
                <td>{f.marca ?? "—"}</td>
                <td><span className="badge">{STATUS_LABEL[f.status]}</span></td>
                <td>
                  <Button title="Gerenciar reparo/estado desta ferramenta" variant="small" onClick={() => selecionar(f)}>Gerenciar</Button>{" "}
                  <Button title="Editar dados cadastrais" variant="small" onClick={() => setForm({ id: f.id, tipo: f.tipo, descricao: f.descricao ?? "", marca: f.marca ?? "" })}>Editar</Button>
                </td>
              </tr>
            ))}
            {ferramentas.length === 0 && <tr><td colSpan={4} className="muted">Nenhuma ferramenta.</td></tr>}
          </tbody>
        </table>
      </Card>

      {sel && (
        <AcoesFerramenta
          ferramenta={sel}
          prestadores={prestadores}
          orcamentos={orcamentos}
          act={act}
          onFechar={() => setSel(null)}
        />
      )}
    </div>
  );
}

// ---------------- Ações contextuais por status ----------------
function AcoesFerramenta({
  ferramenta,
  prestadores,
  orcamentos,
  act,
  onFechar,
}: {
  ferramenta: Ferramenta;
  prestadores: Prestador[];
  orcamentos: Orcamento[];
  act: (fn: () => Promise<void>, ok: string) => void;
  onFechar: () => void;
}) {
  const [prest, setPrest] = useState("");
  const [valor, setValor] = useState("");
  const [descServico, setDescServico] = useState("");
  const [descReparo, setDescReparo] = useState("");
  const internos = prestadores.filter((p) => p.idFuncionario);
  const pendente = orcamentos.find((o) => o.status === "pendente" && !o.canceledAt);
  const s = ferramenta.status;

  return (
    <Card title={`Ações — ${ferramenta.tipo} (${STATUS_LABEL[s]})`}>
      <Button title="Fechar o painel de ações" variant="secondary" onClick={onFechar}>Fechar</Button>
      <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid #e5e7eb" }} />

      {s === "disponivel" && (
        <div className="row tight">
          <Button title="Enviar para reparo (aguardando orçamento)" onClick={() => act(() => api.post(`/ferramentas/${ferramenta.id}/enviar-reparo`), "Enviada para reparo")}>Enviar p/ reparo</Button>
          <Button title="Sucatear a ferramenta (ação irreversível)" variant="danger" onClick={() => { if (confirm("Sucatear?")) act(() => api.post(`/ferramentas/${ferramenta.id}/sucatear`), "Sucateada"); }}>Sucatear</Button>
          <Button title="Excluir a ferramenta" variant="danger" onClick={() => { if (confirm("Excluir?")) act(() => api.del(`/ferramentas/${ferramenta.id}`), "Excluída"); }}>Excluir</Button>
        </div>
      )}

      {s === "aguardando_orcamento" && (
        <div>
          <h4>Cadastrar orçamento</h4>
          <form onSubmit={(e) => { e.preventDefault(); act(() => api.post("/orcamentos", { idFerramenta: ferramenta.id, idPrestador: prest, valorOrcamento: Number(valor), descricaoServico: descServico || null }), "Orçamento cadastrado"); }}>
            <div className="row">
              <div>
                <label title="Prestador que fará o reparo (interno ou externo)">Prestador</label>
                <select title="O tipo do reparo é derivado do prestador (interno/externo)" value={prest} onChange={(e) => setPrest(e.target.value)} required>
                  <option value="">— selecione —</option>
                  {prestadores.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.idFuncionario ? " (interno)" : ""}</option>)}
                </select>
              </div>
              <Field label="Valor (R$)" title="Valor do orçamento" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required />
              <Field label="Descrição" title="Descrição do serviço (opcional)" value={descServico} onChange={(e) => setDescServico(e.target.value)} />
            </div>
            <Button title="Cadastrar o orçamento (ferramenta vai para Aguardando liberação)" type="submit" disabled={!prest || !valor}>Cadastrar orçamento</Button>
          </form>
          <h4 style={{ marginTop: 18 }}>Reparo interno sem orçamento</h4>
          <div className="row">
            <div>
              <label title="Prestador interno (funcionário) — dispensa orçamento">Prestador interno</label>
              <select title="Somente prestadores internos podem iniciar reparo sem orçamento" value={prest} onChange={(e) => setPrest(e.target.value)}>
                <option value="">— selecione —</option>
                {internos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <Button title="Iniciar reparo interno diretamente (sem orçamento)" onClick={() => act(() => api.post("/reparos/interno-direto", { idFerramenta: ferramenta.id, idPrestador: prest }), "Reparo interno iniciado")} disabled={!prest}>Iniciar reparo interno</Button>
          </div>
        </div>
      )}

      {s === "aguardando_liberacao" && (
        <div>
          {pendente ? (
            <div>
              <p className="muted">Orçamento pendente: R$ {pendente.valorOrcamento} · {pendente.tipoReparo}</p>
              <div className="row tight">
                <Button title="Aprovar o orçamento e iniciar o reparo" variant="ok" onClick={() => act(() => api.post(`/orcamentos/${pendente.id}/liberar`), "Orçamento liberado")}>Liberar</Button>
                <Button title="Recusar o orçamento (ferramenta volta a aguardar orçamento; o orçamento é mantido)" variant="danger" onClick={() => act(() => api.post(`/orcamentos/${pendente.id}/recusar`), "Orçamento recusado")}>Recusar</Button>
              </div>
            </div>
          ) : <p className="muted">Nenhum orçamento pendente encontrado.</p>}
        </div>
      )}

      {s === "em_reparo" && (
        <form onSubmit={(e) => { e.preventDefault(); act(() => api.post("/reparos/concluir", { idFerramenta: ferramenta.id, descricaoReparoRealizado: descReparo || null }), "Reparo concluído"); }}>
          <Field label="Descrição do reparo realizado" title="O que foi feito no reparo (opcional)" value={descReparo} onChange={(e) => setDescReparo(e.target.value)} />
          <Button title="Concluir o reparo (ferramenta vai para Aguardando devolução)" type="submit">Concluir reparo</Button>
        </form>
      )}

      {s === "aguardando_devolucao" && (
        <Button title="Confirmar o retorno do reparo (ferramenta volta a Disponível)" onClick={() => act(() => api.post(`/ferramentas/${ferramenta.id}/retornar-reparo`), "Ferramenta retornou ao estoque")}>Retornar do reparo</Button>
      )}

      {s === "alugada" && <p className="muted">Ferramenta alugada — encerre o empréstimo na tela Emprestar.</p>}
      {s === "sucateada" && <p className="muted">Ferramenta sucateada (estado final).</p>}

      {orcamentos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4>Orçamentos da ferramenta</h4>
          <table>
            <thead><tr><th>Valor</th><th>Tipo</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>
              {orcamentos.map((o) => (
                <tr key={o.id}>
                  <td>R$ {o.valorOrcamento}</td>
                  <td>{o.tipoReparo}</td>
                  <td><span className="badge">{o.canceledAt ? "cancelado" : o.status}</span></td>
                  <td>{new Date(o.dataCadastro).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
