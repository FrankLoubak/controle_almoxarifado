# Sprint 8 — Relatórios / análise de dados

## Escopo
Os 8 relatórios da seção 7, cada um como tela com **filtro por período** + **export CSV**
(D10). Todos escopados por tenant (RLS).

1. Ferramentas disponíveis.
2. Ferramentas alugadas + dias decorridos desde o início.
3. Ferramentas aguardando/recusado/liberado orçamento.
4. Ferramentas em reparo e aguardando devolução.
5. Valor total gasto em reparos por ferramenta.
6. Ferramentas sucateadas.
7. Dias totais de empréstimo e de reparo por ferramenta.
8. Ferramentas com empréstimos em aberto, por funcionário (depositário).

## Definition of Done
- [x] Os 8 relatórios implementados (backend + tela única com seletor + filtro de período).
- [x] Export CSV funcional (gerado no cliente a partir do resultado; BOM p/ Excel).
- [x] Cálculos de dias via SQL (EXTRACT/EPOCH) sobre timestamptz; período opcional.
- [x] `tests-agent`: PASS (backend 56/56 incl. 6 de relatórios; frontend 2/2).

## Entregue
Backend: `relatorioService` (8 consultas SQL, tenant-scoped/RLS) + `GET /relatorios`
(catálogo) e `GET /relatorios/:nome?inicio&fim`. Relatórios:
1 disponíveis · 2 alugadas+dias · 3 orçamentos · 4 em reparo/aguardando devolução ·
5 gasto por ferramenta · 6 sucateadas · 7 dias de empréstimo/reparo · 8 abertos por funcionário.
Frontend: tela Relatórios (seletor + período + tabela dinâmica + Exportar CSV).

## Decisões/interpretações
- Período (inicio/fim, YYYY-MM-DD, fim inclusivo) filtra a data relevante de cada
  relatório; relatórios de **estado atual** (1, 4, 6) ignoram o período (indicado na UI).
- "Gasto em reparos" = soma de orçamentos **liberados** por ferramenta.
- Relatório 8 agrupa empréstimos ativos por depositário (qtd + lista de ferramentas).

## Veredito tests-agent (Sprint 8)
`PASS`. Backend cobre catálogo (8), disponíveis, alugadas+dias, gasto (=100), abertos por
funcionário (qtd), dias por ferramenta, filtro por período (vazio vs cheio), 404, autz
401/403 e isolamento entre tenants. Frontend: geração + tabela dinâmica. Builds ok.
