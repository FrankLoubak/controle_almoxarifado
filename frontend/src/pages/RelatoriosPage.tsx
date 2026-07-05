/**
 * Finalidade: tela de Relatórios (seção 7) — seleção do relatório, filtro por período e
 *   export CSV (D10).
 * Como funciona: carrega o catálogo de relatórios; ao gerar, busca as linhas e monta uma
 *   tabela dinâmica (colunas = chaves do resultado). O CSV é gerado no cliente a partir das
 *   linhas e baixado via Blob.
 * Relações: usa api/client; endpoints GET /relatorios e /relatorios/:key.
 */
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Banner, Button, Card, useAsync } from "../components/ui";

interface RelInfo {
  key: string;
  label: string;
  usaPeriodo: boolean;
}
type Row = Record<string, unknown>;

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = rows.map((r) => cols.map((c) => esc(r[c])).join(";"));
  return [cols.join(";"), ...linhas].join("\n");
}

export function RelatoriosPage() {
  const { error, setError, run, loading } = useAsync();
  const [catalogo, setCatalogo] = useState<RelInfo[]>([]);
  const [sel, setSel] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const atual = useMemo(() => catalogo.find((c) => c.key === sel), [catalogo, sel]);
  const cols = rows.length ? Object.keys(rows[0]) : [];

  useEffect(() => {
    api
      .get<RelInfo[]>("/relatorios")
      .then((c) => {
        setCatalogo(c);
        if (c[0]) setSel(c[0].key);
      })
      .catch((e) => setError(e.message));
  }, [setError]);

  function gerar() {
    run(async () => {
      const qs = atual?.usaPeriodo && inicio && fim ? `?inicio=${inicio}&fim=${fim}` : "";
      setRows(await api.get<Row[]>(`/relatorios/${sel}${qs}`));
    });
  }

  function baixarCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2>Relatórios</h2>
      <Banner kind="error">{error}</Banner>

      <Card>
        <div className="row">
          <div>
            <label title="Escolha o relatório a gerar">Relatório</label>
            <select title="Relatórios da seção 7" value={sel} onChange={(e) => setSel(e.target.value)}>
              {catalogo.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label title="Data inicial do período (opcional)">Início</label>
            <input title="Data inicial do período" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={!atual?.usaPeriodo} />
          </div>
          <div>
            <label title="Data final do período (opcional)">Fim</label>
            <input title="Data final do período (inclusiva)" type="date" value={fim} onChange={(e) => setFim(e.target.value)} disabled={!atual?.usaPeriodo} />
          </div>
        </div>
        <Button title="Gerar o relatório selecionado" onClick={gerar} disabled={loading || !sel}>
          {loading ? "Gerando..." : "Gerar"}
        </Button>{" "}
        <Button title="Exportar o resultado atual para CSV" variant="secondary" onClick={baixarCsv} disabled={rows.length === 0}>
          Exportar CSV
        </Button>
        {!atual?.usaPeriodo && <p className="muted">Este relatório reflete o estado atual (sem filtro por período).</p>}
      </Card>

      <Card title={atual?.label ?? "Resultado"}>
        {rows.length === 0 ? (
          <p className="muted">Nenhum dado. Clique em “Gerar”.</p>
        ) : (
          <table>
            <thead>
              <tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c}>{r[c] === null ? "—" : String(r[c])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
