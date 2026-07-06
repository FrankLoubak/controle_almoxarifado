# Sprint 11 — Deploy na VPS Hostinger

## Escopo
- Deploy em produção: VPS Hostinger, **domínio único** `app.<dominio>` (D11).
- Docker Compose: Postgres + backend + frontend (build estático servido).
- Variáveis de ambiente de produção; segredos fora do repositório.
- TLS (Let's Encrypt / proxy reverso), backups de banco.

## Definition of Done
- [x] Artefatos de deploy prontos: Dockerfiles (backend/frontend), `docker-compose.prod.yml`,
  nginx (domínio único), `.env.prod.example`, `DEPLOY.md` (runbook EasyPanel + Compose).
- [x] **Dry-run das imagens de produção na própria VPS**: backend serve `/health`, valida
  entrada (400), aplica helmet; frontend (nginx) builda. Imagens: backend 231MB, frontend 74MB.
- [x] Segredos geridos por env (não versionados); `.env.prod.example` + nota para trocar a
  senha da role `almox_app` (default é de migração/dev).
- [ ] **Publicação no domínio público** — pendente de execução pelo usuário no EasyPanel
  (Traefik/2FA da VPS = fora do acesso desta sessão). Runbook em `DEPLOY.md`.
- [x] `tests-agent`: PASS (66 backend + 2 frontend; smoke da imagem de produção no host).

## Contexto da VPS (descoberto)
A VPS Hostinger roda **EasyPanel + Traefik** (Docker Swarm; portas 80/443 e TLS geridos
pelo painel). Deploy público passa pelo EasyPanel (criar projeto + serviços + domínio); não
se sobe direto no 80/443. Por isso a publicação final é executada pelo usuário (opção 1),
com o runbook pronto.

## Entregue
- `DEPLOY.md`: caminho EasyPanel (recomendado) e Compose; migrations via `node dist/db/migrate.js`;
  troca da senha da role de app; seed; smoke; backups (pg_dump / recurso do painel).
- Dry-run validado no host: imagem de produção do backend sobe e responde; frontend builda.

## Veredito tests-agent (Sprint 11)
`PASS` para o que é validável sem o domínio público: suíte completa verde e **smoke da
imagem de produção rodando na VPS** (`/health` ok, validação 400, header helmet). O smoke
no domínio público fica no runbook para o usuário concluir a publicação no EasyPanel.
