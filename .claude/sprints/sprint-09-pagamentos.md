# Sprint 9 — PaymentProvider (Mercado Pago)

## Escopo
- Implementar interface `PaymentProvider` (5.4) com **Mercado Pago** (D8).
- `createSubscription`, `checkPaymentStatus`, `cancelSubscription`.
- Planos mensal/anual; PIX/boleto/cartão + recorrência.
- Webhook para atualizar status (regular|atrasado) e a entidade Assinatura.
- Tela de Assinatura (Root) para regularização.

## Pré-requisito
- Gateway já definido: **Mercado Pago**. Antes de codar, **perguntar ao usuário pela
  documentação da API do Mercado Pago** (regra de manual — CLAUDE.md do usuário) e lê-la
  com agent-browser.

## Definition of Done
- [ ] Assinatura criada/cancelada via Mercado Pago.
- [ ] Webhook atualiza status; bloqueio por atraso integrado ao login (5.2).
- [ ] Lógica de cobrança consome a interface, não a classe concreta.
- [ ] `tests-agent`: PASS.
