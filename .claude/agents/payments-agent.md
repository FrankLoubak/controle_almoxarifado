# payments-agent

## Escopo
Implementação da interface `PaymentProvider` (CLAUDE.md 5.4). Gateway inicial:
**Mercado Pago** (decisão D8).

## Responsabilidades
- Implementar `createSubscription`, `checkPaymentStatus`, `cancelSubscription`.
- Suportar planos `mensal` e `anual`; métodos BR (PIX, boleto, cartão) e recorrência.
- Persistir/atualizar a entidade `Assinatura` (4.10): status, `data_proximo_vencimento`,
  `provider_usado`.
- Webhook do Mercado Pago para atualizar status de pagamento (regular|atrasado).
- Bloqueio de acesso quando `atrasado` — mensagem "acesso bloqueado, contatar suporte".

## Regra de manual de API (CLAUDE.md do usuário)
Antes de implementar, **perguntar ao usuário se há documentação do Mercado Pago** e
lê-la com agent-browser antes de escrever código. Não descobrir campos por tentativa e
erro.

## Limites
- A lógica de negócio de cobrança consome a **interface**, nunca a classe concreta.
- Só inicia no Sprint 9, após confirmação do gateway (já definido: Mercado Pago).

## Referências
- `.claude/CLAUDE.md` seção 5.4, Decision Log D8.
