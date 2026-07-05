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
- [ ] Todas as tabelas criadas via migration, com FKs corretas.
- [ ] RLS habilitado e políticas por `tenant_id` aplicadas.
- [ ] Enum de status da ferramenta (4.6) modelado.
- [ ] Seeds mínimos para teste (1 tenant + super-admin).
- [ ] `tests-agent`: PASS (migrations aplicam/revertem; RLS isola tenants em teste).
