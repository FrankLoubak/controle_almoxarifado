# Sprint 12 — Painel do super-admin (plataforma)

Sprint adicional (pós-roadmap original) — resolve a pendência do painel super-admin.

## Escopo (decidido com o usuário)
- **Onboarding**: super-admin cria empresa-cliente (tenant) + Root inicial (D4). Super-admin
  define nome + telefone + **senha inicial** do Root.
- **Listar** todas as empresas (com status e ativo).
- **Ativar/desativar** contas — novo campo `tenants.ativo` (D20). Login bloqueia se
  `!ativo` OU pagamento ≠ regular.
- Cross-tenant via funções `SECURITY DEFINER` (D21) — app **não** ganha BYPASSRLS.
- Frontend: **login do super-admin** (e-mail+senha+TOTP) + **painel** (substitui placeholder).

## Definition of Done
- [x] Migration `tenants.ativo` (0006) + funções `superadmin_*` (0007, SECURITY DEFINER + grant).
- [x] Rotas `/admin/*` (super-admin only): `GET/POST /admin/tenants`,
  `PATCH /admin/tenants/:id/ativar|desativar`.
- [x] Bloqueio de login integra `ativo` (verify-otp + refresh) — `getTenantAccess`.
- [x] Frontend: login super-admin (e-mail+senha+TOTP) + painel (lista, onboarding,
  ativar/desativar); App roteia por `claims.type`; link de acesso na tela de login.
- [x] `tests-agent`: PASS (backend 71/71 incl. 5 de admin; frontend 3/3 incl. fluxo super-admin).

## Veredito tests-agent (Sprint 12)
`PASS`. Backend: autz (401/403 p/ funcionário), onboarding (empresa+Root, ativo, Root
amarrado), listagem, CNPJ duplicado 409, e **desativar bloqueia o login do Root / reativar
libera** (integração com o 2FA). Frontend: login TOTP → painel → onboarding com a empresa
aparecendo na lista. Typecheck e builds limpos.

## Decisões
- **D20**: `tenants.ativo` (boolean) separa suspensão administrativa do status de pagamento.
- **D21**: operações cross-tenant do super-admin via funções `SECURITY DEFINER`.

## Decisões
- **D20**: `tenants.ativo` (boolean) separa suspensão administrativa (super-admin) do status
  de pagamento (Root). Login exige `ativo AND status_assinatura='regular'`.
- **D21**: operações do super-admin (cross-tenant) via funções `SECURITY DEFINER` com
  privilégio mínimo (EXECUTE para `almox_app`); sem BYPASSRLS no app.
