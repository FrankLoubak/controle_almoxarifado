# Sprint 6 — Fluxo de Reparo (Orçamento + Reparos + roteamento)

## Escopo
- Orçamento: cadastrar/editar; `tipo_reparo` **derivado** de `Prestador.id_funcionario`;
  status liberado|recusado|pendente; recusado mantido na base (regras 12, 19, 20).
- ReparosExternos (prestador com `id_funcionario = null`).
- ReparosInternos (prestador com `id_funcionario` preenchido; `id_orcamento` nullable).
- **Roteamento automático** por `Prestador.id_funcionario` (regra 13).
- Fluxo de status: `aguardando_orcamento → aguardando_liberacao → em_reparo →
  aguardando_devolucao → disponivel` (regras 10, 11, 18).
- Reparo interno sem peças pode dispensar orçamento.
- Sucatear com reparo/orçamento aberto → cancela reparo/orçamento (mantido) (D13).

## Definition of Done
- [x] Orçamento cadastrado/editado; recusado retorna a `aguardando_orcamento` (regra 20)
  e é mantido na base (regra 12).
- [x] Reparo roteado interno vs externo conforme `Prestador.id_funcionario` (regra 13).
- [x] Reparo interno sem orçamento suportado (regra 11) — `aguardando_orcamento→em_reparo`.
- [x] Fluxo de status completo: enviar→orçamento→liberar→concluir→retornar.
- [x] `tests-agent`: PASS (50/50 — 7 de reparo).

## Endpoints entregues
- Orçamento: `GET/POST /orcamentos`, `GET /orcamentos/:id`, `PATCH /orcamentos/:id`,
  `POST /orcamentos/:id/liberar`, `POST /orcamentos/:id/recusar`.
- Reparo: `GET /reparos`, `POST /reparos/interno-direto`, `POST /reparos/concluir`.
- Autorização: almoxarife (Root incluso); requisitante = usuário autenticado.

## Decisões/interpretações
- `tipo_reparo` **derivado** de `Prestador.id_funcionario` (não escolha livre).
- Liberar orçamento cria o reparo por roteamento (interno: responsável = funcionário do
  prestador; externo: idPrestador) e move a ferramenta para `em_reparo`.
- Reparo interno sem orçamento via `POST /reparos/interno-direto` (só prestador interno;
  externo exige orçamento — regra 10). Máquina de estados ganhou a transição
  `aguardando_orcamento → em_reparo` (skill atualizado).
- Concluir reparo localiza o reparo em aberto (interno/externo) da ferramenta e move para
  `aguardando_devolucao`; o retorno ao estoque é a ação `retornar-reparo` (Sprint 4).

## Veredito tests-agent (Sprint 6)
`PASS`. Cobre: fluxo externo completo (enviar→orçamento→editar→liberar→concluir→retornar),
recusa (mantém orçamento + devolve estado + novo orçamento aceito), roteamento interno
(orçamento + responsável), reparo interno direto sem orçamento e externo direto barrado
(400), guardas de estado (cadastrar exige aguardando_orcamento; liberar/editar exigem
pendente), autorização 401/403 e isolamento entre tenants. Build ok.
