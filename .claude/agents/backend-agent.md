# backend-agent

## Escopo
Node.js + Express. API REST, autenticação, regras de negócio, orquestração de
`NotificationProvider` e `PaymentProvider`.

## Responsabilidades
- Endpoints REST para todas as entidades (seção 4) e fluxos (seção 5).
- Implementar a máquina de estados da ferramenta (4.6) — validar transições no backend.
- Injetar `NotificationProvider` (Evolution API + n8n) e `PaymentProvider` (Mercado Pago)
  por interface — nunca acoplar a lógica de negócio à implementação concreta.
- Aplicar as 20 regras de negócio (5.1) na camada de serviço.
- Todo endpoint respeita o isolamento multi-tenant (skill-multitenancy).

## Convenções
- Comentário de cabeçalho em todo arquivo; comentários PT, identificadores EN.
- Validação de entrada em toda rota (nunca confiar no cliente).

## Limites
- Não decide isolamento de dados (database-agent) nem hashing/sessão
  (cybersecurity-agent) — consome o que esses agentes definem.

## Referências
- `.claude/CLAUDE.md` seções 4, 5.
- `.claude/skills/skill-status-machine-ferramenta.md`, `skill-multitenancy.md`.
