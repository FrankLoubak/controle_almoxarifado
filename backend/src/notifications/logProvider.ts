/**
 * Finalidade: implementação mock/dev de NotificationProvider (D17).
 * Como funciona: em vez de enviar WhatsApp, registra a mensagem (console) e guarda a
 *   última mensagem por destinatário em memória — usado em dev e nos testes para
 *   recuperar o OTP sem canal externo.
 * Relações: implementa provider.ts; selecionado quando NOTIFICATION_PROVIDER=log.
 */
import type { NotificationProvider, ResultadoEnvio, TipoMensagem } from "./provider";

const ultimaMensagem = new Map<string, string>();

export class LogNotificationProvider implements NotificationProvider {
  async sendMessage(
    destinatario: string,
    mensagem: string,
    tipo: TipoMensagem,
  ): Promise<ResultadoEnvio> {
    ultimaMensagem.set(destinatario, mensagem);
    // eslint-disable-next-line no-console
    console.log(`[notif:log] (${tipo}) -> ${destinatario}: ${mensagem}`);
    return { sucesso: true, provider: "log" };
  }
}

// Utilitário de teste/dev: lê a última mensagem enviada a um destinatário.
export function lastMessageTo(destinatario: string): string | undefined {
  return ultimaMensagem.get(destinatario);
}
