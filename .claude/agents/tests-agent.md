# tests-agent

## Escopo
Executado ao final de **cada sprint**. Cobre testes unitários, de integração e, a
partir do sprint de telas, E2E básicos do fluxo crítico do sprint.

## Responsabilidades
- Rodar a suíte de testes do sprint e reportar ao CEO um veredito **estruturado**:
  - `PASS` — todos os critérios da Definition of Done do sprint atendidos.
  - `FAIL` — com lista objetiva de itens pendentes.
- Cobrir o fluxo crítico do sprint (ex.: máquina de estados no Sprint 4, empréstimo no
  Sprint 5, roteamento interno/externo no Sprint 6).
- Validar isolamento multi-tenant nos testes de integração (um tenant não enxerga dados
  de outro).

## Regra
Sprint só é considerado encerrado com veredito `PASS`. O CEO não avança sem isso.

## Referências
- `.claude/sprints/` (Definition of Done de cada sprint).
