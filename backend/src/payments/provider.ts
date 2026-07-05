/**
 * Finalidade: interface PaymentProvider (CLAUDE.md 5.4) — abstrai o gateway de pagamento.
 * Como funciona: define createSubscription/checkPaymentStatus/cancelSubscription e um
 *   parseWebhook opcional (para notificações do gateway). Implementações concretas (mock/
 *   Mercado Pago) ficam em arquivos irmãos e são escolhidas em index.ts.
 * Relações: consumido por assinaturaService; implementado por MockPaymentProvider e
 *   MercadoPagoPaymentProvider. Troca não altera a lógica de cobrança (D19).
 */
export type Plano = "mensal" | "anual";
export type StatusPagamento = "regular" | "atrasado";

export interface AssinaturaResult {
  providerRef: string;
  dataProximoVencimento: Date;
}

export interface WebhookResult {
  tenantId: string;
  status: StatusPagamento;
}

export interface PaymentProvider {
  nome: string;
  createSubscription(tenantId: string, plano: Plano): Promise<AssinaturaResult>;
  checkPaymentStatus(tenantId: string): Promise<StatusPagamento>;
  cancelSubscription(tenantId: string): Promise<void>;
  // Interpreta uma notificação do gateway; null se não reconhecida/ inválida.
  parseWebhook(headers: Record<string, unknown>, body: unknown): WebhookResult | null;
}

// Próximo vencimento a partir do plano (mensal +30 dias, anual +365).
export function proximoVencimento(plano: Plano, base = new Date()): Date {
  const dias = plano === "anual" ? 365 : 30;
  return new Date(base.getTime() + dias * 24 * 3600 * 1000);
}
