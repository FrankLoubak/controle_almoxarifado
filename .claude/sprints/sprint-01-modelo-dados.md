# Sprint 1 — Modelo de dados completo

## Escopo
- Schema Drizzle de todas as entidades (seção 4): Tenant, Funcionário, Prestador,
  Ferramenta, Empréstimo, ReparosExternos, ReparosInternos, Orçamento, Assinatura,
  SuperAdmin.
- Migrations.
- Coluna `tenant_id` + políticas RLS (skill-multitenancy).
- Índices: `numero_telefone` único global, `cnpj` único, `email` SuperAdmin único.
- `timestamptz` (UTC); `deleted_at` para soft-delete.

## Definition of Done
- [x] Todas as tabelas criadas via migration, com FKs corretas. (10 tabelas)
- [x] RLS habilitado e políticas por `tenant_id` aplicadas (+ FORCE RLS; role `almox_app`).
- [x] Enum de status da ferramenta (4.6) modelado (+ orçamento, plano, assinatura, tipo_reparo).
- [x] Seeds mínimos para teste (1 tenant + super-admin + Root).
- [x] `tests-agent`: PASS (migrations aplicam; RLS isola tenants em teste — 5/5).

## Decisões deste sprint
- **D14**: Root = Funcionário com `is_root`; `Tenant.id_root_funcionario` FK.
- **D15**: migrations pelo dono (`MIGRATION_DATABASE_URL`); app via role `almox_app`
  (`DATABASE_URL`) sujeita a RLS + `FORCE ROW LEVEL SECURITY`.
- Índices parciais: telefone único global (`WHERE deleted_at IS NULL`) e empréstimo
  ativo único por ferramenta (`WHERE data_retorno IS NULL`).
- Política RLS usa `NULLIF(current_setting('app.current_tenant', true), '')::uuid` para
  tratar GUC ausente/vazio como NULL (nega sem erro de cast).

## Veredito tests-agent (Sprint 1)
`PASS`. Evidências:
- `npm run db:migrate` → 0000 (schema+RLS) e 0001 (hardening) aplicadas.
- `npm run db:seed` → tenant + super-admin + Root criados.
- `pg_class`: RLS habilitado em todas; FORCE nas 9 tabelas de tenant; `super_admins`
  RLS sem política (nega a role de app).
- `npm test` → 5/5 (isolamento de leitura A/B, fail-safe sem tenant, WITH CHECK barra
  insert cruzado, insert válido só visível ao próprio tenant).
- Ambiente: Postgres do docker-compose no host `5433` (5432 ocupado pelo EasyPanel).
