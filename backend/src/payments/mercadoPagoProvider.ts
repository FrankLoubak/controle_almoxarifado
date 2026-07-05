/**
 * Finalidade: adapter (stub) de PaymentProvider para o Mercado Pago (D19/D8).
 * Como funciona: monta a integração a partir de env (access token); enquanto a
 *   documentação/credenciais não forem fornecidas, permanece como stub que falha de forma
 *   explícita (não silenciosa). PIX/boleto/cartão + assinatura recorrente.
 * Relações: implementa provider.ts; selecionado quando PAYMENT_PROVIDER=mercadopago.
 *   REGRA DO PROJETO: ler a documentação do Mercado Pago (agent-browser) antes de finalizar.
 */
import type {
  AssinaturaResult,
  PaymentProvider,
  Plano,
  StatusPagamento,
  WebhookResult,
} from "./provider";

export class MercadoPagoPaymentProvider implements PaymentProvider {
  nome = "mercadopago";
  private readonly accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";

  private assertConfigured(): void {
    if (!this.accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente — configurar antes de usar o gateway");
    }
    throw new Error("adapter Mercado Pago ainda não implementado (aguardando documentação/credenciais)");
  }

  async createSubscription(_tenantId: string, _plano: Plano): Promise<AssinaturaResult> {
    this.assertConfigured();
    throw new Error("unreachable");
  }
  async checkPaymentStatus(_tenantId: string): Promise<StatusPagamento> {
    this.assertConfigured();
    throw new Error("unreachable");
  }
  async cancelSubscription(_tenantId: string): Promise<void> {
    this.assertConfigured();
  }
  parseWebhook(_headers: Record<string, unknown>, _body: unknown): WebhookResult | null {
    // TODO: validar assinatura (x-signature) e mapear o evento do Mercado Pago.
    return null;
  }
}
