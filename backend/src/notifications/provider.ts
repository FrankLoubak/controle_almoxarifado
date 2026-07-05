/**
 * Finalidade: interface NotificationProvider (CLAUDE.md 5.3) — desacopla a lógica de
 *   negócio do canal de envio (inclui o OTP de 2FA).
 * Como funciona: define o contrato sendMessage e o tipo de retorno; implementações
 *   concretas (log/Evolution) ficam em arquivos irmãos e são escolhidas em index.ts.
 * Relações: consumido pelo serviço de auth; implementado por LogNotificationProvider e
 *   EvolutionNotificationProvider. Troca de implementação não altera o negócio (D17).
 */
export type TipoMensagem = "otp" | "geral";

export interface ResultadoEnvio {
  sucesso: boolean;
  provider: string;
  erro?: string;
}

export interface NotificationProvider {
  sendMessage(destinatario: string, mensagem: string, tipo: TipoMensagem): Promise<ResultadoEnvio>;
}
