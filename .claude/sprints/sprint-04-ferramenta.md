# Sprint 4 — CRUD Ferramenta + máquina de estados

## Escopo
- CRUD de Ferramenta (cadastrar, editar, buscar).
- Máquina de estados do status (4.6) implementada e **validada no backend**.
- Ações: enviar para reparo, retornar do reparo, sucatear.
- Toda transição não listada em skill-status-machine-ferramenta é rejeitada.

## Definition of Done
- [ ] Cadastro/edição/busca de ferramenta.
- [ ] Transições válidas aceitas; inválidas rejeitadas com erro claro.
- [ ] `disponivel → aguardando_orcamento` só a partir de `disponivel` (regra 15).
- [ ] `sucateada` terminal; sucatear bloqueado se `alugada`.
- [ ] `tests-agent`: PASS (cobertura da máquina de estados — fluxo crítico do sprint).
