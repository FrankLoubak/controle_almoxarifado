-- Migration 0007 — funções SECURITY DEFINER do super-admin (D21).
-- O super-admin opera cross-tenant (nível plataforma); o RLS/almox_app não têm esse alcance.
-- Estas funções (executadas como o dono) fazem as operações com privilégio mínimo
-- (só EXECUTE para almox_app). Onboarding cria empresa + Root numa transação.

-- Lista todas as empresas (não deletadas).
CREATE OR REPLACE FUNCTION superadmin_list_tenants()
RETURNS TABLE (
  id uuid, razao_social text, cnpj text, email text, telefone text,
  ativo boolean, status_assinatura assinatura_status, id_root_funcionario uuid, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, razao_social, cnpj, email, telefone, ativo, status_assinatura, id_root_funcionario, created_at
  FROM tenants WHERE deleted_at IS NULL ORDER BY razao_social;
$$;
--> statement-breakpoint

-- Onboarding: cria a empresa e o Root inicial (is_root + almoxarife), amarrando o Root.
CREATE OR REPLACE FUNCTION superadmin_create_tenant(
  p_razao text, p_cnpj text, p_email text, p_telefone text, p_endereco text,
  p_root_nome text, p_root_telefone text, p_root_senha_hash text
) RETURNS TABLE (tenant_id uuid, root_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid; v_root uuid;
BEGIN
  INSERT INTO tenants (razao_social, cnpj, email, telefone, endereco)
    VALUES (p_razao, p_cnpj, p_email, p_telefone, p_endereco) RETURNING id INTO v_tenant;
  INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife, is_root, senha_hash)
    VALUES (v_tenant, p_root_nome, p_root_telefone, true, true, p_root_senha_hash) RETURNING id INTO v_root;
  UPDATE tenants SET id_root_funcionario = v_root WHERE id = v_tenant;
  RETURN QUERY SELECT v_tenant, v_root;
END;
$$;
--> statement-breakpoint

-- Ativa/desativa uma empresa (suspensão administrativa).
CREATE OR REPLACE FUNCTION superadmin_set_tenant_ativo(p_tenant uuid, p_ativo boolean)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE tenants SET ativo = p_ativo, updated_at = now() WHERE id = p_tenant;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION superadmin_list_tenants() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION superadmin_create_tenant(text, text, text, text, text, text, text, text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION superadmin_set_tenant_ativo(uuid, boolean) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION superadmin_list_tenants() TO almox_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION superadmin_create_tenant(text, text, text, text, text, text, text, text) TO almox_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION superadmin_set_tenant_ativo(uuid, boolean) TO almox_app;
