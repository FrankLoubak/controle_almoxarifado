# Sprint 11 — Deploy na VPS Hostinger

## Escopo
- Deploy em produção: VPS Hostinger, **domínio único** `app.<dominio>` (D11).
- Docker Compose: Postgres + backend + frontend (build estático servido).
- Variáveis de ambiente de produção; segredos fora do repositório.
- TLS (Let's Encrypt / proxy reverso), backups de banco.

## Definition of Done
- [ ] Aplicação acessível em produção via domínio único.
- [ ] Postgres com RLS ativo em produção; backups configurados.
- [ ] Segredos geridos com segurança (não versionados).
- [ ] Smoke test pós-deploy dos fluxos críticos.
- [ ] `tests-agent`: PASS (smoke/E2E em produção).
