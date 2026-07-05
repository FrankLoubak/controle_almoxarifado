# Sprint 4 — CRUD Ferramenta + máquina de estados

## Escopo
- CRUD de Ferramenta (cadastrar, editar, buscar).
- Máquina de estados do status (4.6) implementada e **validada no backend**.
- Ações: enviar para reparo, retornar do reparo, sucatear.
- Toda transição não listada em skill-status-machine-ferramenta é rejeitada.

## Definition of Done
- [x] Cadastro/edição/busca de ferramenta (`?search=` em tipo/marca/descrição, `?status=`).
- [x] Transições válidas aceitas; inválidas rejeitadas com 409 (máquina de estados central).
- [x] `disponivel → aguardando_orcamento` só a partir de `disponivel` (regra 15).
- [x] `sucateada` terminal; sucatear bloqueado se `alugada`; sucatear cancela reparo/
  orçamento em aberto (D13).
- [x] `tests-agent`: PASS (35/35 — 3 unit da máquina de estados + 8 integração ferramenta).

## Endpoints entregues
- CRUD: `GET/POST /ferramentas`, `GET/PATCH/DELETE /ferramentas/:id`.
- Ações: `POST /ferramentas/:id/enviar-reparo` (disponivel→aguardando_orcamento),
  `.../retornar-reparo` (aguardando_devolucao→disponivel), `.../sucatear` (→sucateada + D13).
- Autorização: almoxarife (Root incluso).

## Decisões/interpretações
- Máquina de estados central em `domain/toolStatusMachine.ts` (transições válidas +
  `assertTransition`/`canScrap`) — reutilizada pelos Sprints 5/6.
- Status muda **apenas via ações** (não via PATCH). Ações têm guarda de estado de origem
  (ex.: retornar-reparo exige `aguardando_devolucao`, pois `disponivel` também é alvo de
  `alugada→disponivel`, que é encerramento de empréstimo — Sprint 5).
- Soft-delete (D9) permitido só em `disponivel`/`sucateada` (status é ciclo de vida).

## Veredito tests-agent (Sprint 4)
`PASS`. Cobre: unitário da máquina de estados (transições válidas/ inválidas, regra de
sucateamento); integração CRUD, autorização 401/403, isolamento entre tenants, enviar-
reparo (regra 15 + repetição 409), retornar-reparo (guarda de origem), sucatear (ok/
alugada 409/terminal 409 + cancelamento em cascata D13) e guarda de exclusão. Build ok.
