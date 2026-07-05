# Sprint 2 — Autenticação + 2FA + sessão

## Escopo
- Login almoxarife/Root: telefone + senha → 2FA via `NotificationProvider` (Evolution API).
- Login super-admin: e-mail + senha → 2FA (área separada).
- OTP: 6 dígitos, 5 min, máx. 5 tentativas, reenvio 60s (D6).
- Sessão JWT: access 15min + refresh 7 dias (cookie httpOnly) + revogação (D5).
- Hashing de senha (bcrypt/argon2), rate limiting no login e no OTP.
- Verificação de status de pagamento pós-2FA: atrasado → "acesso bloqueado, contatar suporte".

## Definition of Done
- [x] Fluxo completo login → 2FA → sessão para Root/almoxarife (OTP WhatsApp) e
  super-admin (TOTP). Rotas em `/auth/*` e `/auth/super-admin/*`.
- [x] OTP com expiração (5min), limite de tentativas (5) e reenvio (cooldown 60s).
- [x] Refresh token revogável (opaco, hash em `refresh_tokens`); access token (JWT) expira.
- [x] Rate limiting ativo (login/OTP); senhas com hash forte (argon2id).
- [x] Bloqueio por pagamento atrasado funcionando (403 "acesso bloqueado, contatar suporte").
- [x] `tests-agent`: PASS (9 testes de integração de auth + 5 de RLS = 14/14).

## Decisões deste sprint
- **D16** super-admin 2FA = TOTP; **D17** NotificationProvider selecionável por env
  (log/mock agora, Evolution stub); **D18** lookup de login via funções SECURITY DEFINER.
- Refresh token é **opaco** (aleatório) persistido como HMAC + snapshot das claims (jsonb)
  para re-emitir no /refresh; rotação revoga o anterior.
- Build de produção via **esbuild** (bundle) — dist ESM funcional; `typecheck` separado (tsc).

## Veredito tests-agent (Sprint 2)
`PASS`. Evidências:
- `npm run typecheck` limpo; `npm run build` (esbuild) → dist funcional; boot + `/health` ok.
- `npm test` → 14/14 (login+OTP+/me, senha errada, OTP errado, desafio inexistente,
  refresh+rotação+logout, bloqueio por pagamento 403, super-admin TOTP ok/errado,
  rate limit 429, + isolamento RLS do Sprint 1).
- OTP lido do adapter mock (LogNotificationProvider) nos testes.

## ⚠️ Backlog técnico — Gatilho de migração de 2FA
Ao atingir **10 tenants ativos**, migrar 2FA da Evolution API (canal não-oficial) para
BSP oficial (Twilio ou 360dialog). Trocar apenas a classe concreta de
`NotificationProvider` — sem tocar na lógica de negócio.
