# Controle de Almoxarifado

SaaS multi-tenant para gestão de almoxarifado de empresas que fazem empréstimo interno
de ferramentas. Ver o contexto completo do projeto em [`.claude/CLAUDE.md`](.claude/CLAUDE.md)
e o prompt-especificação em [`prompt_claude_code_almoxarifado.md`](prompt_claude_code_almoxarifado.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express |
| Banco | PostgreSQL (multi-tenant via `tenant_id` + RLS) |
| ORM | Drizzle |
| Auth | JWT (access+refresh) + 2FA OTP (WhatsApp) |
| Notificação | Evolution API + n8n (`NotificationProvider`) |
| Pagamento | Mercado Pago (`PaymentProvider`) |
| Deploy | Docker Compose · VPS Hostinger |

## Setup local

Pré-requisitos: Node.js 20+, Docker.

```bash
# 1. Subir o Postgres
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run dev            # http://localhost:3000/health

# 3. Frontend (outro terminal)
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Estrutura

```
.claude/        contexto do projeto (CLAUDE.md, agents, skills, sprints)
backend/        API Node + Express + Drizzle
frontend/       React + Vite
docker-compose.yml
```

## Manual de uso por perfil

> Preenchido conforme os sprints avançam (Sprint 7 em diante).

- **Super-admin** (dono do SaaS): cadastra empresas-cliente (tenants) e o Root inicial;
  ativa/desativa contas; acompanha cobrança da plataforma.
- **Root** (admin da empresa): cadastra o primeiro almoxarife, promove almoxarifes,
  gerencia a assinatura da empresa.
- **Almoxarife**: cadastra funcionários/prestadores/ferramentas, realiza empréstimos,
  gerencia reparos e orçamentos.
- **Depositário**: recebe ferramentas em custódia (sem login).

## Desenvolvimento por sprints

O projeto é conduzido por um agente CEO que orquestra sub-agentes especialistas, sprint
a sprint. Ver [`.claude/sprints/`](.claude/sprints/). Nenhum sprint avança sem veredito
`PASS` do `tests-agent`.
