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
- [ ] Orçamento cadastrado/editado; recusado retorna a `aguardando_orcamento` e é mantido.
- [ ] Reparo roteado corretamente interno vs externo conforme `id_funcionario`.
- [ ] Reparo interno sem orçamento suportado.
- [ ] Fluxo de status completo funcionando.
- [ ] `tests-agent`: PASS (fluxo crítico: roteamento + transições de reparo).
