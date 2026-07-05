/**
 * Finalidade: tela de Assinatura (Root) — status, criar/regularizar/cancelar.
 * Como funciona: consulta a assinatura e o status do tenant; permite (re)assinar (plano
 *   mensal/anual), regularizar (simula pagamento no mock) e cancelar. Só o Root gerencia.
 * Relações: usa api/client e AuthContext; endpoints /assinatura.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Banner, Button, Card, useAsync } from "../components/ui";

interface Assinatura {
  id: string;
  plano: "mensal" | "anual";
  status: string;
  dataInicio: string;
  dataProximoVencimento: string;
  providerUsado: string;
}
interface Resp {
  assinatura: Assinatura | null;
  tenantStatus: string | null;
}

export function AssinaturaPage() {
  const { claims } = useAuth();
  const { error, success, run } = useAsync();
  const [dados, setDados] = useState<Resp | null>(null);
  const [plano, setPlano] = useState<"mensal" | "anual">("mensal");

  const load = useCallback(() => run(async () => setDados(await api.get<Resp>("/assinatura"))), [run]);
  useEffect(() => {
    if (claims?.isRoot) load();
  }, [claims, load]);

  if (!claims?.isRoot) {
    return (
      <div>
        <h2>Assinatura</h2>
        <div className="card"><p className="muted">Apenas o Root da empresa gerencia a assinatura.</p></div>
      </div>
    );
  }

  const st = dados?.tenantStatus;
  const cor = st === "regular" ? "success" : "error";

  return (
    <div>
      <h2>Assinatura</h2>
      <Banner kind="error">{error}</Banner>
      <Banner kind="success">{success}</Banner>

      <Card title="Status">
        <p>
          Acesso da empresa:{" "}
          <span className="badge" title="Status de pagamento que libera/bloqueia o acesso">{st ?? "—"}</span>
        </p>
        {st !== "regular" && <Banner kind={cor}>Pagamento não regular — o acesso pode estar bloqueado.</Banner>}
        {dados?.assinatura ? (
          <table>
            <tbody>
              <tr><th>Plano</th><td>{dados.assinatura.plano}</td></tr>
              <tr><th>Status</th><td>{dados.assinatura.status}</td></tr>
              <tr><th>Próximo vencimento</th><td>{new Date(dados.assinatura.dataProximoVencimento).toLocaleDateString("pt-BR")}</td></tr>
              <tr><th>Gateway</th><td>{dados.assinatura.providerUsado}</td></tr>
            </tbody>
          </table>
        ) : <p className="muted">Nenhuma assinatura ativa.</p>}
      </Card>

      <Card title="Gerenciar">
        <div className="row">
          <div>
            <label title="Periodicidade da assinatura">Plano</label>
            <select title="Escolha mensal ou anual" value={plano} onChange={(e) => setPlano(e.target.value as "mensal" | "anual")}>
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </div>
        <Button title="Criar/ativar a assinatura no plano escolhido" onClick={() => run(async () => { await api.post("/assinatura", { plano }); await api.get<Resp>("/assinatura").then(setDados); }, "Assinatura ativada")}>
          Assinar / ativar
        </Button>{" "}
        <Button title="Regularizar o pagamento (simulado no ambiente mock)" variant="ok" onClick={() => run(async () => { await api.post("/assinatura/regularizar"); await api.get<Resp>("/assinatura").then(setDados); }, "Pagamento regularizado")}>
          Regularizar
        </Button>{" "}
        <Button title="Cancelar a assinatura da empresa" variant="danger" onClick={() => run(async () => { if (!confirm("Cancelar a assinatura?")) return; await api.post("/assinatura/cancelar"); await api.get<Resp>("/assinatura").then(setDados); }, "Assinatura cancelada")}>
          Cancelar
        </Button>
      </Card>
    </div>
  );
}
