# Deploy — Sistema de Almoxarifado (VPS Hostinger)

Deploy em **domínio único** (D11): um único host serve o frontend (SPA) e faz proxy de
`/api` para o backend; Postgres com RLS. Há dois caminhos: **EasyPanel** (recomendado nesta
VPS, que já roda EasyPanel + Traefik) ou **Docker Compose** direto (VPS sem painel).

Pré-requisitos: repositório no GitHub, segredos fortes (`openssl rand -hex 32`).

---

## Opção A — EasyPanel (recomendado nesta VPS)

A VPS já roda EasyPanel com Traefik (portas 80/443 e TLS/Let's Encrypt gerenciados pelo
painel). Não suba nada direto no 80/443 — crie os serviços pelo painel.

1. **Criar projeto** `controle-almoxarifado` no EasyPanel.
2. **Serviço Postgres** (tipo Postgres do painel): defina usuário/senha/DB; anote a URL
   interna (ex.: `postgres://almox:...@controle-almoxarifado_db:5432/almoxarifado`).
3. **Serviço backend** (App, source = GitHub, build por Dockerfile em `backend/`):
   - Env: `NODE_ENV=production`, `MIGRATION_DATABASE_URL`, `DATABASE_URL`,
     `JWT_ACCESS_SECRET`, `OTP_PEPPER`, `TOKEN_PEPPER`, `NOTIFICATION_PROVIDER`,
     `PAYMENT_PROVIDER` (ver `.env.prod.example`).
   - Porta interna: 3000. Não exponha domínio direto (o frontend faz o proxy `/api`).
4. **Migrations**: após o primeiro build do backend, rode uma vez, no console do serviço:
   `node dist/db/migrate.js`. Em seguida **troque a senha da role de app**:
   `ALTER ROLE almox_app PASSWORD '...';` e ajuste `DATABASE_URL`.
5. **Serviço frontend** (App, build por Dockerfile em `frontend/`):
   - No `nginx.conf`, `proxy_pass` deve apontar para o host interno do backend
     (ajuste `http://backend:3000/` para o nome do serviço no painel, ex.:
     `http://controle-almoxarifado_backend:3000/`).
   - **Domínio**: atribua o domínio/subdomínio a este serviço no painel (Traefik emite o
     certificado TLS automaticamente).
6. **Seed inicial** (1º tenant + super-admin + Root): rode no console do backend
   `node dist/db/seed.js` (ou crie via SQL). Anote as credenciais exibidas.
7. **Smoke test**: acesse o domínio, faça login (2FA), cadastre uma ferramenta.

---

## Opção B — Docker Compose (VPS sem painel)

```bash
git clone https://github.com/FrankLoubak/controle_almoxarifado.git
cd controle_almoxarifado
cp .env.prod.example .env && $EDITOR .env      # preencha segredos

# 1) Sobe o Postgres
docker compose -f docker-compose.prod.yml up -d postgres

# 2) Aplica as migrations (cria tabelas, RLS, role almox_app)
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate

# 3) (produção) troque a senha da role de app e reflita no .env (DATABASE_URL)
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U almox -d almoxarifado -c "ALTER ROLE almox_app PASSWORD 'senha-app-forte';"

# 4) Sobe backend + frontend
docker compose -f docker-compose.prod.yml up -d --build backend frontend

# 5) Smoke
curl -fsS http://localhost:${FRONTEND_PORT:-80}/api/health
```

TLS: coloque um reverse proxy com HTTPS na frente (Caddy/nginx+certbot/Cloudflare) apontando
para a porta do frontend.

---

## Backups
- Agende `pg_dump` diário (retenção conforme política LGPD do CLAUDE.md) e teste a restauração.
- No EasyPanel, use o recurso de backup do serviço Postgres.

## Segurança (ver SECURITY.md)
- Segredos só via env/secret manager (nunca no repositório).
- Troque a senha da role `almox_app` (default de migração é de dev).
- Confirme HTTPS/HSTS ativos e o `npm audit` das dependências antes do go-live.
