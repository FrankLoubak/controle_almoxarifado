# Sprint 5 — Fluxo de Empréstimo

## Escopo
- Realizar empréstimo: ferramenta `disponivel` + depositário (funcionário) +
  emprestador (`status_almoxarife = true`) → status `alugada`.
- Encerrar empréstimo (só se ativo) → status `disponivel`.
- Regras 1, 3, 4, 8, 14, 16.

## Definition of Done
- [ ] Empréstimo só de ferramenta `disponivel`; emprestador é almoxarife.
- [ ] Uma ferramenta em apenas um empréstimo ativo; depositário com vários simultâneos.
- [ ] Encerramento só de empréstimo ativo; ferramenta volta a `disponivel`.
- [ ] `tests-agent`: PASS (fluxo crítico: realizar/encerrar + regras de exclusividade).
