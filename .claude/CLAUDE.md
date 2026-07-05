# CLAUDE.md — Sistema de Gestão de Almoxarifado (SaaS multi-tenant)

> Arquivo mestre de contexto do projeto. Instruções permanentes, arquitetura,
> convenções e decisões técnicas. Deve ser mantido atualizado pelo **agente CEO**
> ao final de cada sprint.

---

## 0. Regra permanente de operação (INVIOLÁVEL)

Em nenhum momento o Claude Code (ou qualquer sub-agente) deve preencher lacunas de
especificação com **suposições**. Se surgir ambiguidade, contradição ou informação
faltante não coberta por este documento, o **agente CEO deve parar a execução e
formular uma pergunta objetiva ao usuário**, listando as opções quando aplicável.

Isso vale para todos os sub-agentes: nenhum decide sozinho sobre **modelagem de
dados, regra de negócio ou fluxo não especificado** — apenas sobre detalhes de
implementação técnica (nome de variável, escolha de biblioteca dentro do já definido).

Não avançar para o próximo sprint sem:
1. Veredito `PASS` do `tests-agent`.
2. Confirmação do CEO de que não há pendência de esclarecimento em aberto.

---

## 1. Visão geral do produto

SaaS multi-tenant para gestão de almoxarifado de empresas que fazem **empréstimo
interno de ferramentas**.

- **Multi-tenant**: cada empresa-cliente (tenant) tem dados isolados — Root,
  funcionários, ferramentas, empréstimos, reparos e orçamentos próprios.
- **Super-admin da plataforma**: papel único do dono do SaaS. Visão sobre todos os
  tenants, cobrança da plataforma e ativação/desativação de contas. É **separado** do
  Root de cada empresa.
- **Cobrança do tenant**: cada empresa paga assinatura (mensal ou anual) via gateway,
  administrada pelo Root da própria empresa.

### Perfis de usuário
| Perfil | Login | Escopo |
|---|---|---|
| Super-admin | e-mail + senha + 2FA | Plataforma inteira (todos os tenants, cobrança, ativação) |
| Root | telefone + senha + 2FA WhatsApp | Sua empresa: cadastra 1º almoxarife, promove almoxarifes, gere assinatura |
| Almoxarife | telefone + senha + 2FA WhatsApp | Operação: cadastros, empréstimos, reparos, orçamentos |
| Depositário | **sem login** | Apenas registro cadastral; recebe ferramentas em custódia |

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express (API REST) |
| Banco | PostgreSQL |
| ORM/query builder | **Drizzle ORM** (decisão do database-agent) |
| Auth | JWT (access 15min + refresh 7 dias, cookie httpOnly) + 2FA OTP |
| Notificação | Interface `NotificationProvider` → Evolution API + n8n (impl. inicial) |
| Pagamento | Interface `PaymentProvider` → **Mercado Pago** (impl. inicial) |
| Deploy | Docker Compose em VPS Hostinger, domínio único |

Estrutura do repositório:
```
/
├── .claude/            # contexto do projeto (este diretório)
│   ├── CLAUDE.md
│   ├── agents/         # 1 arquivo por sub-agente
│   ├── skills/         # skills reutilizáveis
│   └── sprints/        # 1 arquivo por sprint (escopo + Definition of Done)
├── backend/            # Node.js + Express + Drizzle
├── frontend/           # React + Vite
├── docker-compose.yml  # Postgres + app (produção/dev)
└── .gitignore
```

---

## 3. Convenções de código

- **Comentário de cabeçalho obrigatório** em todo arquivo de código: finalidade,
  como funciona (resumo) e com quais módulos se relaciona. Ver
  `.claude/skills/skill-commenting-standard.md`.
- **Idioma**: comentários em **português**; identificadores (variáveis, funções,
  classes, tabelas, colunas) em **inglês**.
- Acessibilidade no frontend: `title`/tooltip via `onMouseOver` em todos os campos e
  botões.

---

## 4. Modelo de dados

> Toda tabela pertence a um tenant via coluna `tenant_id` (exceto entidades de nível
> de plataforma: `Tenant`, `SuperAdmin`, `Assinatura`). Isolamento por **RLS**
> (ver `.claude/skills/skill-multitenancy.md`).

### 4.1 Tenant (empresa-cliente) — nível plataforma
- `id`
- `razao_social`, `cnpj` (único), `email`, `telefone`, `endereco`
- `status_assinatura` (ver 5.4)
- `id_root_funcionario` (FK nullable → Funcionário com `is_root = true`) — D14.
- Um Tenant tem um usuário Root associado.
- **Criado exclusivamente pelo super-admin** (não há self-signup).

### 4.2 Funcionário
- `id`, `nome`, `data_cadastro`, `numero_telefone` (**único global**), `cpf`,
  `email` (opcional), `data_admissao`
- `status_almoxarife` (booleano)
- `is_root` (booleano — D14; Root implica `status_almoxarife = true`)
- `senha` — exigida **somente** quando `status_almoxarife = true`; nula enquanto for
  apenas depositário sem login.
- **Métodos**: cadastrar, excluir (soft-delete), editar, promover a almoxarife
  (ação exclusiva do Root, dispara exigência de criação de senha).

### 4.3 Prestador de serviço
- `id`, `nome`, `endereco`, `telefone`
- `id_funcionario` (nullable, FK Funcionário) — se preenchido, o "prestador" é na
  verdade um funcionário interno → reparo roteado para `ReparosInternos`.
- Sem login próprio.

### 4.4 Ferramenta
- `id`, `tipo` (manual/elétrica/pneumática/etc.), `descricao`, `marca`
- `status` — enum na seção 4.6
- **Métodos**: cadastrar, enviar para reparo, retornar do reparo, sucatear.

### 4.5 Empréstimo
- `id`, `id_ferramenta` (FK), `data_saida`, `data_retorno`
- `id_depositario` (FK Funcionário)
- `id_funcionario_emprestador` (FK Funcionário, `status_almoxarife = true`)
- **Regras**: um depositário pode ter várias ferramentas; uma ferramenta só em um
  empréstimo ativo por vez; só encerra empréstimo ativo; ao encerrar → `disponivel`.

### 4.6 Status da ferramenta (enum — validado literalmente pelo usuário)
```
disponivel · alugada · aguardando_orcamento · aguardando_liberacao
em_reparo · aguardando_devolucao · sucateada
```
Transições — ver `.claude/skills/skill-status-machine-ferramenta.md`:
- `disponivel` → `alugada` (empréstimo)
- `alugada` → `disponivel` (encerrar empréstimo)
- `disponivel` → `aguardando_orcamento` (enviar p/ reparo — só se `disponivel`)
- `aguardando_orcamento` → `aguardando_liberacao` (cadastrar orçamento)
- `aguardando_liberacao` → `em_reparo` (orçamento aprovado)
- `aguardando_liberacao` → `aguardando_orcamento` (orçamento recusado — orçamento
  **mantido** na base, não excluído)
- `em_reparo` → `aguardando_devolucao` (reparo concluído)
- `aguardando_devolucao` → `disponivel` (retorno do reparo)
- qualquer status **exceto `alugada`** → `sucateada`

### 4.7 ReparosExternos
- `id`, `id_ferramenta` (FK), `id_funcionario_requisitante` (FK)
- `data_inicio`, `data_fim`, `descricao_reparo_realizado`, `id_orcamento` (FK)
- `id_prestador` (FK — obrigatoriamente prestador com `id_funcionario = null`)

### 4.8 ReparosInternos
- `id`, `id_funcionario_requisitante` (FK), `id_funcionario_responsavel` (FK)
- `id_ferramenta` (FK), `data_inicio`, `data_fim`, `descricao_reparo_realizado`
- `id_orcamento` (FK, **nullable** — reparo interno pode dispensar orçamento)
- **Roteamento**: reparo cadastrado a partir de `Prestador` com `id_funcionario`
  preenchido → grava em `ReparosInternos` com `id_funcionario_responsavel` = o
  funcionário vinculado.

### 4.9 Orçamento
- `id`, `id_ferramenta` (FK), `id_prestador` (FK)
- `tipo_reparo` (externo|interno — **derivado** de `Prestador.id_funcionario`; não é
  campo de escolha livre)
- `data_cadastro`, `descricao_servico`, `valor_orcamento`
- `status` (liberado | recusado | pendente)
- **Regra**: orçamento recusado permanece na base (análise histórica), não é excluído.

### 4.10 Assinatura / Pagamento — nível plataforma
- `id`, `tenant_id`, `plano` (mensal|anual), `status`, `data_inicio`,
  `data_proximo_vencimento`, `provider_usado`.

### 4.11 SuperAdmin — nível plataforma
- `id`, `nome`, `email` (único), `senha` (hash), campos de 2FA.

---

## 5. Regras de negócio, auth, pagamento e notificação

### 5.1 Regras de negócio consolidadas
1. Ferramenta só tem um depositário por aluguel ativo.
2. Depositário deve ser funcionário cadastrado.
3. Quem empresta deve ter `status_almoxarife = true`.
4. Depositário pode ter vários empréstimos simultâneos; cada ferramenta só em um por vez.
5. Root atribui status de almoxarife e cadastra funcionários.
6. Almoxarife pode cadastrar demais funcionários.
7. Primeiro almoxarife de cada empresa é cadastrado pelo Root.
8. Ferramenta só é emprestada se `disponivel`.
9. `alugada`/`aguardando_orcamento`/`aguardando_liberacao`/`em_reparo`/`aguardando_devolucao`/`sucateada` ⇒ indisponível.
10. Ferramenta só vai a `em_reparo` após orçamento aprovado — exceto reparo interno sem peças.
11. Reparo interno pode ou não exigir orçamento.
12. Orçamento recusado é mantido na base.
13. Reparo externo ⇒ prestador com `id_funcionario = null`; prestador com `id_funcionario` ⇒ reparo interno.
14. Só encerra empréstimo ativo.
15. Ferramenta só vai a reparo se `disponivel`.
16. Encerrar empréstimo → `disponivel`.
17. Retorno de reparo (`aguardando_devolucao` → `disponivel`).
18. Enviar a reparo exige orçamento antes da autorização (`aguardando_orcamento` → `aguardando_liberacao` → `em_reparo`).
19. Orçamento pode ser editado.
20. Orçamento recusado retorna a ferramenta para `aguardando_orcamento`.

### 5.2 Autenticação
- **Almoxarife/Root**: telefone + senha → 2FA por WhatsApp (OTP). Depositário não tem login.
- **Super-admin**: e-mail + senha → 2FA por **TOTP** (D16), em área separada.
- **Hashing**: argon2id. Fluxo em 2 passos (senha → desafio 2FA → JWT).
- Lookup de login é cross-tenant via funções `SECURITY DEFINER` (D18).
- **OTP (2FA)**: 6 dígitos numéricos, validade **5 min**, máx. **5 tentativas**,
  reenvio permitido após **60s**.
- **Sessão**: JWT — access token 15min + refresh token 7 dias em cookie httpOnly;
  revogação via lista de refresh tokens.
- Após 2FA, verificar status de pagamento do tenant:
  - regular → libera acesso.
  - atrasado → bloquear com **"acesso bloqueado, contatar suporte"**.
- Regularização de pagamento é responsabilidade exclusiva do Root.

### 5.3 Interface `NotificationProvider`
```ts
interface NotificationProvider {
  sendMessage(destinatario: string, mensagem: string, tipo: 'otp' | 'geral'): Promise<ResultadoEnvio>
}
```
- Impl. inicial: **Evolution API + n8n** (2FA + notificações gerais).
- Dívida técnica aceita: canal não-oficial para 2FA, em troca de custo zero.
- ⚠️ **GATILHO DE MIGRAÇÃO**: ao atingir **10 tenants ativos**, migrar 2FA para BSP
  oficial (Twilio ou 360dialog). Ver backlog em `.claude/sprints/sprint-02-auth.md`.
- Troca de implementação não altera a lógica de negócio — apenas a classe injetada.

### 5.4 Interface `PaymentProvider`
```ts
interface PaymentProvider {
  createSubscription(tenantId, plano: 'mensal' | 'anual'): Promise<Assinatura>
  checkPaymentStatus(tenantId): Promise<'regular' | 'atrasado'>
  cancelSubscription(tenantId): Promise<void>
}
```
- Impl. inicial: **Mercado Pago** (PIX/boleto/cartão, assinatura recorrente).

---

## 6. Telas (frontend)

Design limpo, intuitivo, tooltip (`title`/`onMouseOver`) em cada campo e botão.
1. **Login**: telefone + senha → verificação de código 2FA (WhatsApp).
2. **Cadastrar** (funcionário ou prestador): com busca por nome.
3. **Emprestar**: busca de ferramenta + depositário → registrar empréstimo.
4. **Ferramentas**: cadastrar, enviar a reparo, sucatear; busca de ferramenta e
   prestador; cadastro de reparo (fluxo de status da 4.6).
5. **Assinatura (Root)**: status do plano, regularização/pagamento (Mercado Pago).
6. **Painel super-admin**: lista de tenants, ativar/desativar, cobrança da plataforma.
7. **Relatórios** (seção 7): tela com filtro por período + export CSV.

### Convenções de tela
- Tenant resolvido pelo login (telefone único global) — **domínio único** `app.<dominio>`.

---

## 7. Relatórios (seção 7)

Cada um como tela com filtro de período + botão **Exportar CSV**:
1. Ferramentas disponíveis.
2. Ferramentas alugadas + dias decorridos desde o início.
3. Ferramentas aguardando/recusado/liberado orçamento.
4. Ferramentas em reparo e aguardando devolução.
5. Valor total gasto em reparos por ferramenta.
6. Ferramentas sucateadas.
7. Dias totais de empréstimo e de reparo por ferramenta.
8. Ferramentas com empréstimos em aberto, por funcionário (depositário).

---

## 8. Decisões técnicas registradas (Decision Log)

| # | Decisão | Justificativa |
|---|---|---|
| D1 | Multi-tenancy por `tenant_id` + **RLS** no Postgres | Operação mais simples, migrations únicas, adequado ao porte inicial (<dezenas de tenants). |
| D2 | Telefone **único global** | Login por telefone+senha resolve o tenant sem passo extra. |
| D3 | ORM **Drizzle** | TS-first, SQL explícito, boa integração com RLS/políticas Postgres. |
| D4 | Onboarding de tenant **pelo super-admin** | Controle de cobrança e ativação; sem tela pública de signup. |
| D5 | Auth: JWT access+refresh, cookie httpOnly | Stateless, escala; revogação via lista de refresh. |
| D6 | OTP 6 dígitos / 5 min / 5 tentativas / reenvio 60s | Padrão de mercado. |
| D7 | Super-admin login separado (e-mail+2FA) | Desacopla o admin da plataforma do canal WhatsApp não-oficial. |
| D8 | Gateway inicial **Mercado Pago** | Público BR: PIX/boleto/cartão + recorrência nativa. |
| D9 | Exclusão = **soft-delete** + bloqueio se vínculo ativo | Preserva histórico/relatórios; evita quebra referencial. |
| D10 | Relatórios: tela + filtro período + **CSV** | Cobre uso prático sem custo de layout PDF. |
| D11 | Deploy **domínio único** + Docker Compose (Hostinger) | Simples; tenant resolvido no login. |
| D12 | Timezone `America/Sao_Paulo`, moeda **BRL**, timestamps em UTC (`timestamptz`) | Consistência de datas nos relatórios. |
| D13 | Sucatear ferramenta com reparo/orçamento em aberto → reparo/orçamento **cancelado** (mantido na base) e status → `sucateada` | Consistência da máquina de estados sem perder histórico. |
| D14 | Root = **Funcionário com `is_root = true`** (e `status_almoxarife = true`); `Tenant.id_root_funcionario` (FK nullable) aponta pra ele | Reaproveita login/2FA de funcionário; menor desvio da spec (mantém `status_almoxarife` booleano). |
| D15 | Migrations aplicadas pelo **dono** (`MIGRATION_DATABASE_URL`); app conecta como role **sem privilégio** `almox_app` (`DATABASE_URL`), sujeita ao RLS + `FORCE ROW LEVEL SECURITY` | RLS não se aplica a superuser/owner; role dedicada garante isolamento real. |
| D16 | 2FA do **super-admin = TOTP** (app autenticador); `totp_secret` cifrado em `super_admins` | Não depende do canal WhatsApp não-oficial; área da plataforma mais segura. |
| D17 | `NotificationProvider` com **adapter selecionável por env** (`NOTIFICATION_PROVIDER=log\|evolution`); `log` (mock) agora, `evolution` como stub configurável | Sprint 2 testável sem credenciais; troca sem mexer na lógica de negócio (5.3). |
| D18 | Login resolve funcionário/super-admin por telefone/e-mail **global** via funções `SECURITY DEFINER` (`auth_lookup_*`), pois o RLS nega leitura sem tenant; app **não** tem `BYPASSRLS` | Necessário para login por telefone global; mantém isolamento (privilégio mínimo). `otp_challenges` e `refresh_tokens` são tabelas de plataforma (sem RLS de tenant). |
| D19 | `PaymentProvider` com **adapter selecionável por env** (`PAYMENT_PROVIDER=mock\|mercadopago`); `mock` agora, Mercado Pago como stub configurável | Sprint 9 testável sem credenciais; troca sem mexer na lógica de cobrança (5.4). Webhook aplica update via função `SECURITY DEFINER` (sem contexto de tenant). |

### Nota LGPD
Dados pessoais (nome, telefone, CPF, e-mail de funcionários) são tratados com
soft-delete; não há hard-delete que apague histórico legítimo. Retenção alinhada à
necessidade operacional e fiscal. Reavaliar política de retenção antes do go-live.

---

## 9. Pendências abertas (para o CEO levantar no sprint correspondente)

Nenhuma pendência **bloqueante** em aberto — todas as decisões estruturais foram
tomadas (ver Decision Log). Reavaliar apenas se surgir novo requisito:
- Detalhamento fino das telas de super-admin (Sprint 7) conforme evolução.
- Política de retenção LGPD definitiva antes do go-live (Sprint 10/11).

---

## 10. Instrução final por sprint

Ao final de cada sprint, gerar/atualizar:
- `.claude/CLAUDE.md` com decisões técnicas tomadas.
- `README.md` com stack, setup local e manual de uso por perfil (Root, Almoxarife,
  Depositário, Super-admin).
- Executar `tests-agent` → só encerrar o sprint com veredito `PASS`.
