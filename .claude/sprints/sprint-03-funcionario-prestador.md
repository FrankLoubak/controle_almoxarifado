# Sprint 3 — CRUD Funcionário, Prestador e promoção a almoxarife

## Escopo
- CRUD de Funcionário (cadastrar, editar, excluir=soft-delete, buscar por nome).
- CRUD de Prestador (com `id_funcionario` nullable → base do roteamento de reparo).
- Promoção a almoxarife (ação exclusiva do Root → exige criação de senha).
- Regras 2, 5, 6, 7 (quem pode cadastrar quem; 1º almoxarife pelo Root).
- Soft-delete + bloqueio se houver vínculo ativo (D9).

## Definition of Done
- [x] Root cadastra o primeiro almoxarife (via criar + promover); almoxarife cadastra
  demais funcionários.
- [x] Promoção a almoxarife dispara exigência de senha (endpoint Root-only exige `senha`).
- [x] Depositário (sem `status_almoxarife`) não tem senha/login (criado como depositário).
- [x] Exclusão bloqueada com vínculo ativo; soft-delete preserva histórico (D9).
- [x] Busca por nome (funcionário e prestador) — `GET /...?search=`.
- [x] `tests-agent`: PASS (10 testes Sprint 3 + 9 auth + 5 RLS = 24/24).

## Endpoints entregues
- Funcionário: `GET/POST /funcionarios`, `GET/PATCH/DELETE /funcionarios/:id`,
  `POST /funcionarios/:id/promover` (Root only).
- Prestador: `GET/POST /prestadores`, `GET/PATCH/DELETE /prestadores/:id`.
- Autorização: almoxarife (Root incluso) para CRUD; promoção só Root (regras 5/6).

## Decisões/interpretações
- Fluxo de almoxarife = **criar (depositário) → promover** (método 4.2 "promover a
  almoxarife"); promoção exige senha e é exclusiva do Root (regra 5/7).
- Bloqueio de exclusão (D9): Root da empresa, empréstimo ativo, reparo em aberto
  (interno/externo), ou funcionário referenciado por prestador ativo; prestador com
  reparo externo em aberto ou orçamento pendente.
- Telefone duplicado → 409 (índice único global parcial do Sprint 1).

## Veredito tests-agent (Sprint 3)
`PASS`. Cobre: autorização (401/403), criação por almoxarife/Root, busca por nome,
telefone duplicado (409), promoção Root-only (403 p/ almoxarife), edição, soft-delete +
404 pós-exclusão, bloqueio de exclusão do Root e por empréstimo ativo, isolamento entre
tenants, e CRUD de prestador (interno válido/ inválido, soft-delete e bloqueio por reparo
externo em aberto). Typecheck limpo; build esbuild ok.
