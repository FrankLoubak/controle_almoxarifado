-- Migration 0001 — Hardening de multi-tenancy (RLS) e role de aplicação.
-- Complementa a 0000: cria a role sem privilégio usada pela aplicação, concede DML,
-- e força RLS mesmo para o dono das tabelas (FORCE), garantindo isolamento real.
-- Ver .claude/skills/skill-multitenancy.md e Decision Log D15.

-- Role de aplicação (idempotente). Sujeita ao RLS; NÃO é superuser nem tem BYPASSRLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'almox_app') THEN
    CREATE ROLE almox_app LOGIN PASSWORD 'almox_app_dev';
  END IF;
END $$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO almox_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO almox_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO almox_app;--> statement-breakpoint

-- FORCE RLS: aplica as políticas inclusive ao dono das tabelas (defesa em profundidade).
-- super_admins NÃO recebe FORCE aqui — tem RLS habilitado sem política, então nega tudo
-- para a role de aplicação (só o dono/superuser acessa).
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assinaturas" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funcionarios" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prestadores" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ferramentas" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "emprestimos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orcamentos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reparos_externos" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reparos_internos" FORCE ROW LEVEL SECURITY;
