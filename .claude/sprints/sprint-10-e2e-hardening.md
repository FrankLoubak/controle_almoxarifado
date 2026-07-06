# Sprint 10 — E2E completo + hardening de segurança

## Escopo
- Testes end-to-end completos dos fluxos principais.
- Hardening (cybersecurity-agent): revisão de injeção/XSS/CSRF, rate limiting, headers
  de segurança, auditoria de logs, revisão de RLS.
- Definição da política de retenção LGPD antes do go-live.
- Preparação para deploy.

## Definition of Done
- [x] Suíte E2E cobrindo login/2FA → cadastro → empréstimo → reparo → relatórios →
  assinatura (teste único ponta a ponta via HTTP, login real com OTP do mock).
- [x] Checklist de segurança revisado e aprovado (`SECURITY.md`) + verificação automatizada
  (helmet, FORCE RLS, role sem BYPASSRLS/superuser).
- [x] Política de retenção LGPD documentada no `CLAUDE.md`.
- [x] Preparação para deploy: Dockerfiles (backend/frontend), nginx (domínio único),
  `docker-compose.prod.yml`, bundle do migrate para produção.
- [x] `tests-agent`: PASS (backend 66/66; frontend 2/2).

## Entregue
- Hardening: helmet, rate limit global + body limit (100kb) + auditoria de requisições
  mutantes (`middleware/security.ts`).
- Teste E2E completo (`e2e.test.ts`) + verificação de segurança (`seguranca.test.ts`).
- `SECURITY.md` (checklist revisado) e política de retenção LGPD no CLAUDE.md.
- Prep de deploy: `backend/Dockerfile`, `frontend/Dockerfile` + `nginx.conf`,
  `docker-compose.prod.yml`; `npm run build` empacota `index` e `db/migrate`.

## Bug corrigido no caminho
`reparos.test.ts` limpava tenants por `LIKE 'T %'`, apagando dados de outros arquivos de
teste em paralelo (flakiness). Agora deleta só os próprios tenants. Teste de período de
relatório tornado robusto a fuso (intervalo ontem..amanhã).

## Veredito tests-agent (Sprint 10)
`PASS`. 66 testes backend (incl. E2E completo e verificação de hardening) + 2 frontend.
Builds (backend esbuild com migrate; frontend vite) e typechecks limpos.
