# Segurança — checklist revisado (Sprint 10)

Revisão de hardening do sistema de almoxarifado (cybersecurity-agent). Itens ✅ implementados
e verificados; ⏳ recomendações para o go-live (Sprint 11).

## Autenticação e sessão
- ✅ Senhas com **argon2id** (nunca em texto claro).
- ✅ 2FA: OTP por WhatsApp (funcionário/Root) e **TOTP** (super-admin). OTP só como HMAC,
  expiração 5 min, máx. 5 tentativas, reenvio 60s.
- ✅ Sessão: JWT access curto (15 min) + refresh **opaco revogável** (hash em DB).
- ✅ Cookie de refresh `httpOnly`, `sameSite=lax`, `secure` em produção.
- ✅ Lookup de login cross-tenant via funções `SECURITY DEFINER` (sem `BYPASSRLS` no app).

## Isolamento multi-tenant
- ✅ RLS por `tenant_id` em todas as tabelas de tenant + **FORCE ROW LEVEL SECURITY**.
- ✅ App conecta como role **`almox_app`** (não superuser, sem `BYPASSRLS`) — verificado em teste.
- ✅ `tenant_id` derivado do JWT; nunca do corpo/query do cliente.
- ✅ Webhook de pagamento escreve via `SECURITY DEFINER` com privilégio mínimo.

## Superfície HTTP
- ✅ Cabeçalhos de segurança via **helmet** (nosniff, sem `x-powered-by`, etc.).
- ✅ **Rate limiting**: global + específicos em login e envio de OTP.
- ✅ Limite de payload JSON (100kb) — anti-DoS.
- ✅ Validação de entrada com **zod** em todas as rotas.
- ✅ Autorização por papel (almoxarife/Root) nas rotas de negócio.
- ✅ **Auditoria**: log estruturado das requisições mutantes (usuário/tenant/status/IP).

## Injeção / dados
- ✅ Queries parametrizadas (Drizzle / `pg`) — sem concatenação de SQL com entrada do usuário.
- ✅ Frontend React (escapa saída por padrão); API responde JSON.
- ✅ Soft-delete preserva histórico; sem hard-delete de dados legítimos.

## Recomendações para o go-live (⏳ Sprint 11)
- ⏳ TLS/HTTPS (Let's Encrypt) no proxy; HSTS habilitado.
- ⏳ Rate limiting/auditoria com store distribuído (Redis) se houver múltiplas instâncias.
- ⏳ Rotação/gerência de segredos (JWT/peppers/DB) fora do repositório.
- ⏳ Backups de banco + teste de restauração.
- ⏳ `npm audit` das dependências transitivas; atualizar antes do go-live.
- ⏳ Jobs de expurgo de `otp_challenges`/`refresh_tokens` expirados (ver política LGPD).
- ⏳ Migração de 2FA para BSP oficial ao atingir 10 tenants ativos.
