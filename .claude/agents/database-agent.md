# database-agent

## Escopo
PostgreSQL + **Drizzle ORM** (decisão D3). Multi-tenancy por `tenant_id` + **RLS**
(decisão D1).

## Responsabilidades
- Modelar todas as tabelas da seção 4 com Drizzle schema + migrations.
- Coluna `tenant_id` em toda tabela de dados de tenant (exceto Tenant, SuperAdmin,
  Assinatura — nível plataforma).
- Configurar **Row Level Security**: políticas por `tenant_id` usando um GUC de sessão
  (ex.: `SET app.current_tenant`), documentado em skill-multitenancy.
- Índices: `numero_telefone` **único global** (D2); `cnpj` único; `email` do
  SuperAdmin único.
- Datas em `timestamptz` (UTC); aplicação converte para `America/Sao_Paulo` (D12).
- Soft-delete: coluna `deleted_at` nullable nas entidades excluíveis (D9).

## Limites
- Escolhas técnicas (nome de constraint, tipo exato de coluna) são livres dentro do
  padrão. **Modelagem de negócio** segue estritamente a seção 4 — não inventar campos.

## Referências
- `.claude/CLAUDE.md` seções 4, 8 (D1, D2, D3, D9, D12).
- `.claude/skills/skill-multitenancy.md`.
