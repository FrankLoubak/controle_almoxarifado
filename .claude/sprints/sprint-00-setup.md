# Sprint 0 — Setup

## Escopo
- Estrutura `.claude/` (CLAUDE.md, agents, skills, sprints).
- `.gitignore` para Node.js + variáveis de ambiente.
- Esqueleto de projeto: `backend/` (Node + Express + Drizzle) e `frontend/` (React + Vite).
- Configuração de banco (Postgres) e estratégia de multi-tenancy (`tenant_id` + RLS).
- `docker-compose.yml` (Postgres) para dev.
- `.env.example` em backend e frontend.

## Definition of Done
- [x] `.claude/` populado (CLAUDE.md com seções 1,4,5,6,7 + Decision Log).
- [x] `.gitignore` presente.
- [x] `backend/` e `frontend/` com package.json, tsconfig e estrutura de pastas.
- [x] `docker-compose.yml` sobe Postgres localmente.
- [x] `.env.example` documentando variáveis necessárias.
- [x] `tests-agent`: PASS — `npm install` (backend+frontend), build backend (`tsc`) e
  frontend (`tsc && vite build`) sem erros; smoke test `/health` respondendo `ok`.

## Notas
Decisões estruturais já travadas no Decision Log (D1–D13). Sem pendência bloqueante.

## Veredito tests-agent (Sprint 0)
`PASS`. Evidências:
- backend: `npm run build` → `dist/index.js` gerado, exit 0.
- frontend: `npm run build` → `dist/` gerado (30 módulos), exit 0.
- smoke: `GET /health` → `{"status":"ok","service":"almoxarifado-backend"}`.
Observação: porta 3000 ocupada pelo EasyPanel nesta máquina — usar `PORT` alternativa em
dev local. `npm audit` reporta vulnerabilidades transitivas (revisar no hardening, Sprint 10).
