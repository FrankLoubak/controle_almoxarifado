/**
 * Finalidade: adapter (stub) de NotificationProvider para Evolution API + n8n (D17).
 * Como funciona: monta a chamada HTTP à Evolution API a partir de env; enquanto as
 *   credenciais/documentação não forem fornecidas, permanece como stub que falha de forma
 *   explícita (não silenciosa), para não mascarar ausência de canal de 2FA.
 * Relações: implementa provider.ts; selecionado quando NOTIFICATION_PROVIDER=evolution.
 *   REGRA DO PROJETO: ler a documentação da Evolution API (agent-browser) antes de
 *   finalizar esta implementação. Migrar 2FA para BSP oficial ao atingir 10 tenants.
 */
import type { NotificationProvider, ResultadoEnvio, TipoMensagem } from "./provider";

export class EvolutionNotificationProvider implements NotificationProvider {
  private readonly baseUrl = process.env.EVOLUTION_API_URL ?? "";
  private readonly apiKey = process.env.EVOLUTION_API_KEY ?? "";

  async sendMessage(
    destinatario: string,
    mensagem: string,
    _tipo: TipoMensagem,
  ): Promise<ResultadoEnvio> {
    if (!this.baseUrl || !this.apiKey) {
      return {
        sucesso: false,
        provider: "evolution",
        erro: "credenciais Evolution API ausentes — configurar EVOLUTION_API_URL/KEY",
      };
    }
    // TODO(Sprint 2+): implementar o POST real após ler a doc da Evolution API.
    // Endpoint/payload a confirmar na documentação (número + texto). Ver CLAUDE.md 5.3.
    void destinatario;
    void mensagem;
    return {
      sucesso: false,
      provider: "evolution",
      erro: "adapter Evolution ainda não implementado (aguardando documentação/credenciais)",
    };
  }
}
