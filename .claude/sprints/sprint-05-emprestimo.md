# Sprint 5 — Fluxo de Empréstimo

## Escopo
- Realizar empréstimo: ferramenta `disponivel` + depositário (funcionário) +
  emprestador (`status_almoxarife = true`) → status `alugada`.
- Encerrar empréstimo (só se ativo) → status `disponivel`.
- Regras 1, 3, 4, 8, 14, 16.

## Definition of Done
- [x] Empréstimo só de ferramenta `disponivel` (regra 8); emprestador é o almoxarife
  autenticado (regra 3).
- [x] Uma ferramenta em apenas um empréstimo ativo (regra 1, índice parcial);
  depositário com vários simultâneos (regra 4).
- [x] Encerramento só de empréstimo ativo (regra 14); ferramenta volta a `disponivel`
  (regra 16).
- [x] `tests-agent`: PASS (43/43 — 8 de empréstimo).

## Endpoints entregues
- `GET/POST /emprestimos` (list com `?ativo`/`?depositario`/`?ferramenta`),
  `GET /emprestimos/:id`, `POST /emprestimos/:id/encerrar`.
- Autorização: almoxarife (Root incluso).

## Decisões/interpretações
- Emprestador = `req.auth.sub` (almoxarife autenticado) — a rota exige almoxarife (regra 3).
- Realizar e encerrar são **atômicos** (transação única: grava empréstimo + move status
  da ferramenta), reusando a máquina de estados (`disponivel↔alugada`).
- Regra 1 garantida pelo índice `uq_emprestimo_ferramenta_ativo`; corrida mapeada p/ 409.

## Veredito tests-agent (Sprint 5)
`PASS`. Cobre: realizar (→alugada), ferramenta indisponível 409, depositário inválido
400, ferramenta inexistente 404, múltiplos empréstimos por depositário (regra 4),
encerrar (→disponivel + reencerrar 409 + reempréstimo), encerrar inexistente 404,
autorização 401/403, listagem de ativos e isolamento entre tenants. Build ok.
