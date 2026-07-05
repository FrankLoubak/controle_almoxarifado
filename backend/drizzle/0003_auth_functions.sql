-- Migration 0003 — Funções SECURITY DEFINER para lookup de login (D18).
-- Como telefone/e-mail são globais, o login precisa achar o usuário ANTES de fixar o
-- tenant; o RLS nega leitura sem tenant. Estas funções rodam como o dono (definer),
-- retornando o MÍNIMO necessário para autenticar, sem dar BYPASSRLS à role de app.
-- Ver .claude/skills/skill-multitenancy.md.

-- Lookup de funcionário por telefone (apenas quem tem login: status_almoxarife=true).
-- Retorna também o status da assinatura do tenant para o bloqueio pós-2FA (CLAUDE.md 5.2).
CREATE OR REPLACE FUNCTION auth_lookup_funcionario(p_phone text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  senha_hash text,
  status_almoxarife boolean,
  is_root boolean,
  tenant_status assinatura_status
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.tenant_id, f.senha_hash, f.status_almoxarife, f.is_root, t.status_assinatura
  FROM funcionarios f
  JOIN tenants t ON t.id = f.tenant_id
  WHERE f.numero_telefone = p_phone
    AND f.deleted_at IS NULL
    AND f.status_almoxarife = true
  LIMIT 1;
$$;
--> statement-breakpoint

-- Lookup de super-admin por e-mail (TOTP — D16).
CREATE OR REPLACE FUNCTION auth_lookup_super_admin(p_email text)
RETURNS TABLE (
  id uuid,
  senha_hash text,
  totp_secret text,
  totp_enabled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.senha_hash, s.totp_secret, s.totp_enabled
  FROM super_admins s
  WHERE s.email = p_email
  LIMIT 1;
$$;
--> statement-breakpoint

-- A role de aplicação pode EXECUTAR as funções, mas não ler as tabelas diretamente.
REVOKE ALL ON FUNCTION auth_lookup_funcionario(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_lookup_super_admin(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_funcionario(text) TO almox_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_super_admin(text) TO almox_app;
