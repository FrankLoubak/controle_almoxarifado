/**
 * Finalidade: factory que seleciona a implementação de PaymentProvider por env (D19).
 * Como funciona: lê config.paymentProvider (mock|mercadopago) e devolve um singleton.
 * Relações: usado por assinaturaService; troca de gateway sem alterar a lógica de cobrança.
 */
import { config } from "../config/env";
import { MercadoPagoPaymentProvider } from "./mercadoPagoProvider";
import { MockPaymentProvider } from "./mockProvider";
import type { PaymentProvider } from "./provider";

let instance: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!instance) {
    instance =
      config.paymentProvider === "mercadopago"
        ? new MercadoPagoPaymentProvider()
        : new MockPaymentProvider();
  }
  return instance;
}

export * from "./provider";
