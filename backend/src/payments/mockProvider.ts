/**
 * Finalidade: implementação mock/dev de PaymentProvider (D19).
 * Como funciona: simula o gateway sem chamadas externas — createSubscription devolve uma
 *   referência fake e o próximo vencimento; checkPaymentStatus é 'regular'; parseWebhook
 *   aceita um corpo { tenantId, status } para simular a notificação do gateway.
 * Relações: implementa provider.ts; selecionado quando PAYMENT_PROVIDER=mock.
 */
import { randomUUID } from "node:crypto";
import {
  proximoVencimento,
  type AssinaturaResult,
  type PaymentProvider,
  type Plano,
  type StatusPagamento,
  type WebhookResult,
} from "./provider";

export class MockPaymentProvider implements PaymentProvider {
  nome = "mock";

  async createSubscription(_tenantId: string, plano: Plano): Promise<AssinaturaResult> {
    return { providerRef: `mock-${randomUUID()}`, dataProximoVencimento: proximoVencimento(plano) };
  }

  async checkPaymentStatus(_tenantId: string): Promise<StatusPagamento> {
    return "regular";
  }

  async cancelSubscription(_tenantId: string): Promise<void> {
    /* nada a fazer no mock */
  }

  parseWebhook(_headers: Record<string, unknown>, body: unknown): WebhookResult | null {
    const b = body as { tenantId?: string; status?: string };
    if (!b?.tenantId || (b.status !== "regular" && b.status !== "atrasado")) return null;
    return { tenantId: b.tenantId, status: b.status };
  }
}
