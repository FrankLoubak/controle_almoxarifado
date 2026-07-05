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
- [x] Assinatura criada/cancelada/regularizada via `PaymentProvider` (adapter **mock**;
  Mercado Pago como stub plugável por env — D19).
- [x] Webhook (público) atualiza status; bloqueio por atraso integrado ao login (5.2) via
  `tenants.status_assinatura` (atualizado por todas as operações).
- [x] Lógica de cobrança consome a **interface**, não a classe concreta.
- [x] Tela de Assinatura (Root): status + criar/cancelar/regularizar.
- [x] `tests-agent`: PASS (backend 62/62 incl. 6 de assinatura; frontend 2/2).

## Entregue
- Interface `PaymentProvider` (createSubscription/checkPaymentStatus/cancelSubscription +
  parseWebhook); adapters `mock` e `mercadopago` (stub); factory por env (D19).
- `assinaturaService` orquestra provider + entidade Assinatura + `tenants.status_assinatura`.
- Rotas Root: `GET/POST /assinatura`, `POST /assinatura/cancelar`, `POST /assinatura/regularizar`.
- Webhook público `POST /pagamentos/webhook` → aplica status via função `SECURITY DEFINER`
  `apply_payment_update` (sem contexto de tenant; migration 0005).
- Frontend: tela Assinatura (Root) substitui o placeholder.

## Decisões/interpretações
- Gestão da assinatura é **exclusiva do Root** (5.2) — rotas com `requireRoot`.
- Webhook não é autenticado como tenant → escreve via `SECURITY DEFINER` (privilégio mínimo).
- Regularização no mock **simula** pagamento aprovado e estende o vencimento pelo plano.

## Pré-requisito atendido (regra do projeto)
Perguntado ao usuário sobre doc/credenciais do Mercado Pago antes de codar — optou por
interface + mock agora; adapter real fica plugável (env `PAYMENT_PROVIDER=mercadopago`).

## Veredito tests-agent (Sprint 9)
`PASS`. Backend: autz Root (403/401), consulta inicial (atrasado), criar (→regular +
tenant regular), webhook (atrasado + corpo inválido 400), regularizar (→regular), cancelar
(→cancelado), com verificação de `tenants.status_assinatura`. Frontend: build/typecheck ok.
