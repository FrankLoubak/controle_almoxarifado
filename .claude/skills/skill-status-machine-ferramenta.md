# skill-status-machine-ferramenta

Máquina de estados do `status` da Ferramenta (CLAUDE.md 4.6). Transições válidas e
quem pode disparar cada uma. **Toda transição é validada no backend** (backend-agent);
uma transição não listada aqui deve ser rejeitada.

## Estados
```
disponivel · alugada · aguardando_orcamento · aguardando_liberacao
em_reparo · aguardando_devolucao · sucateada
```

## Transições válidas
| De | Para | Gatilho | Endpoint/ação | Quem |
|---|---|---|---|---|
| disponivel | alugada | realizar empréstimo | POST /loans | almoxarife |
| alugada | disponivel | encerrar empréstimo | PATCH /loans/:id/close | almoxarife |
| disponivel | aguardando_orcamento | enviar p/ reparo (só se disponivel) | POST /tools/:id/to-repair | almoxarife |
| aguardando_orcamento | aguardando_liberacao | cadastrar orçamento | POST /orcamentos | almoxarife |
| aguardando_orcamento | em_reparo | reparo interno sem orçamento (regra 11) | POST /reparos/interno-direto | almoxarife |
| aguardando_liberacao | em_reparo | orçamento aprovado | PATCH /budgets/:id (liberado) | almoxarife |
| aguardando_liberacao | aguardando_orcamento | orçamento recusado (orçamento mantido) | PATCH /budgets/:id (recusado) | almoxarife |
| em_reparo | aguardando_devolucao | reparo concluído | PATCH /repairs/:id/finish | almoxarife |
| aguardando_devolucao | disponivel | retorno do reparo | PATCH /tools/:id/return | almoxarife |
| qualquer **exceto alugada** | sucateada | sucatear | PATCH /tools/:id/scrap | almoxarife |

## Regras associadas
- **Enviar a reparo** só é permitido se a ferramenta estiver `disponivel` (regra 15).
- **Reparo interno sem peças** pode ir direto a `em_reparo` sem orçamento (regra 10/11) —
  neste caso a transição `aguardando_orcamento → aguardando_liberacao → em_reparo` é
  substituída por criação do reparo interno com `id_orcamento = null`.
- **Orçamento recusado** retorna a `aguardando_orcamento` e o orçamento é **mantido** na
  base para análise histórica (regras 12, 20).
- **Sucatear com reparo/orçamento em aberto** (decisão D13): o reparo/orçamento é
  encerrado como *cancelado* (mantido na base) e o status vai para `sucateada`.
- `sucateada` é estado **terminal**.

## Referências
- `.claude/CLAUDE.md` seções 4.6, 5.1 (regras 10, 11, 12, 15, 20), Decision Log D13.
