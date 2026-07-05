# Sprint 2 — Autenticação + 2FA + sessão

## Escopo
- Login almoxarife/Root: telefone + senha → 2FA via `NotificationProvider` (Evolution API).
- Login super-admin: e-mail + senha → 2FA (área separada).
- OTP: 6 dígitos, 5 min, máx. 5 tentativas, reenvio 60s (D6).
- Sessão JWT: access 15min + refresh 7 dias (cookie httpOnly) + revogação (D5).
- Hashing de senha (bcrypt/argon2), rate limiting no login e no OTP.
- Verificação de status de pagamento pós-2FA: atrasado → "acesso bloqueado, contatar suporte".

## Definition of Done
- [ ] Fluxo completo login → 2FA → sessão para Root/almoxarife e super-admin.
- [ ] OTP com expiração, limite de tentativas e reenvio.
- [ ] Refresh token revogável; access token expira.
- [ ] Rate limiting ativo; senhas com hash forte.
- [ ] Bloqueio por pagamento atrasado funcionando.
- [ ] `tests-agent`: PASS (unitário + integração dos fluxos de auth).

## ⚠️ Backlog técnico — Gatilho de migração de 2FA
Ao atingir **10 tenants ativos**, migrar 2FA da Evolution API (canal não-oficial) para
BSP oficial (Twilio ou 360dialog). Trocar apenas a classe concreta de
`NotificationProvider` — sem tocar na lógica de negócio.
