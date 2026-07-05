-- Migration 0005 — função SECURITY DEFINER para o webhook de pagamento (D19).
-- O webhook do gateway não é autenticado como tenant (sem app.current_tenant), então o
-- RLS negaria a escrita. Esta função (executada como o dono) aplica o status de pagamento
-- ao tenant e à sua assinatura mais recente, com privilégio mínimo (só EXECUTE p/ almox_app).

CREATE OR REPLACE FUNCTION apply_payment_update(
  p_tenant uuid,
  p_status assinatura_status,
  p_venc timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tenants SET status_assinatura = p_status, updated_at = now() WHERE id = p_tenant;
  UPDATE assinaturas a
    SET status = p_status,
        data_proximo_vencimento = COALESCE(p_venc, a.data_proximo_vencimento),
        updated_at = now()
  WHERE a.id = (
    SELECT id FROM assinaturas WHERE tenant_id = p_tenant ORDER BY created_at DESC LIMIT 1
  );
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION apply_payment_update(uuid, assinatura_status, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION apply_payment_update(uuid, assinatura_status, timestamptz) TO almox_app;
