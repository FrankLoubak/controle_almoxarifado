# Sprint 3 — CRUD Funcionário, Prestador e promoção a almoxarife

## Escopo
- CRUD de Funcionário (cadastrar, editar, excluir=soft-delete, buscar por nome).
- CRUD de Prestador (com `id_funcionario` nullable → base do roteamento de reparo).
- Promoção a almoxarife (ação exclusiva do Root → exige criação de senha).
- Regras 2, 5, 6, 7 (quem pode cadastrar quem; 1º almoxarife pelo Root).
- Soft-delete + bloqueio se houver vínculo ativo (D9).

## Definition of Done
- [ ] Root cadastra o primeiro almoxarife; almoxarife cadastra demais funcionários.
- [ ] Promoção a almoxarife dispara exigência de senha.
- [ ] Depositário (sem `status_almoxarife`) não tem senha/login.
- [ ] Exclusão bloqueada com vínculo ativo; soft-delete preserva histórico.
- [ ] Busca por nome (funcionário e prestador).
- [ ] `tests-agent`: PASS.
