# Sprint 7 — Telas de frontend integradas

## Escopo
- Telas (seção 6): Login/2FA, Cadastrar (funcionário/prestador com busca), Emprestar,
  Ferramentas (com fluxo de reparo), Assinatura (Root), Painel super-admin.
- Integração com a API do backend.
- Tooltip (`title`/`onMouseOver`) em todos os campos e botões.
- E2E básico do fluxo crítico.

## Definition of Done
- [x] Telas operacionais navegáveis e integradas à API: Login/2FA, Cadastrar
  (funcionário/prestador com busca), Emprestar, Ferramentas (+ fluxo de reparo).
  Assinatura e Painel super-admin como placeholders (backend futuro).
- [x] Tooltips (`title`) em campos e botões (componentes Field/Button + selects).
- [x] Design limpo e intuitivo (CSS próprio, dependência zero); tenant resolvido no login.
- [x] E2E básico: login → 2FA → tela protegida → cadastrar ferramenta (Testing Library).
- [x] `tests-agent`: PASS (frontend 1/1 fluxo crítico; backend 50/50 mantidos).

## Escopo (decidido com o usuário)
- Construídas as **4 telas operacionais** (backend pronto). **Assinatura → Sprint 9**;
  **Painel super-admin → sprint próprio** (faltam endpoints de gestão de tenants). Ambas
  ficam como placeholders navegáveis.
- E2E via **Vitest + Testing Library (jsdom) com API mockada** (rápido, CI-friendly).

## Stack/arquitetura do frontend
- React + Vite + TypeScript; `react-router-dom`; contexto de auth (login 2 passos +
  refresh silencioso via cookie); cliente `fetch` com bearer + auto-refresh no 401.
- Proxy Vite `/api` → backend (rewrite remove o prefixo). Cookie de refresh path `/`
  (ajuste no backend p/ compatibilidade com o proxy).

## Veredito tests-agent (Sprint 7)
`PASS`. Frontend: fluxo crítico login→2FA→cadastro de ferramenta com API mockada. Build
de produção (tsc + vite) ok; typecheck limpo. Backend inalterado (50/50) após o ajuste de
cookie path.

## Pendências herdadas
- Painel super-admin exige endpoints de gestão de tenants (ativar/desativar, listar) —
  levantar escopo antes do sprint dedicado.
- Tela de Assinatura entra no Sprint 9 (PaymentProvider/Mercado Pago).
