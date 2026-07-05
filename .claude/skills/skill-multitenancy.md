# skill-multitenancy

Regras de isolamento de dados entre tenants — seguidas por **todo endpoint** da API.
Estratégia: `tenant_id` + **Row Level Security (RLS)** no PostgreSQL (decisão D1).

## Princípios
1. Toda tabela de dados de tenant tem coluna **`tenant_id`** (NOT NULL).
   Exceções (nível plataforma, sem `tenant_id`): `Tenant`, `SuperAdmin`, `Assinatura`.
2. **Nenhuma query confia no cliente** para informar o tenant. O `tenant_id` vem do
   token autenticado (JWT), nunca de parâmetro de requisição.
3. O telefone é **único global** (D2) — o login resolve o tenant do usuário a partir do
   número; a partir daí todo acesso é escopado a esse tenant.

## Implementação com RLS
- A cada requisição autenticada, o backend define o tenant corrente na conexão:
  ```sql
  SET app.current_tenant = '<tenant_id>';
  ```
- Políticas RLS em cada tabela filtram por esse GUC:
  ```sql
  ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON tools
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
  ```
- O usuário de aplicação do Postgres **não** deve ter `BYPASSRLS`.
- Operações do super-admin usam um caminho separado (conexão/role sem escopo de tenant),
  jamais reutilizando a sessão de tenant.

## Checklist por endpoint
- [ ] `tenant_id` derivado exclusivamente do JWT.
- [ ] Conexão configura `app.current_tenant` antes de qualquer query.
- [ ] Nenhuma rota aceita `tenant_id` do corpo/query do cliente.
- [ ] Teste de integração confirma que tenant A não lê/escreve dados de tenant B.

## Referências
- `.claude/CLAUDE.md` seções 4 e 8 (D1, D2).
