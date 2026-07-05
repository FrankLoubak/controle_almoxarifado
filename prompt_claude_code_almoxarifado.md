# Prompt para Claude Code — Sistema de Gestão de Almoxarifado (SaaS Multi-tenant)

> **Como usar este arquivo**: cole o conteúdo abaixo como instrução inicial para o Claude Code dentro do VS Code, no repositório do projeto já conectado ao GitHub. O Claude Code deve executar o passo "0. Setup" primeiro, criando a estrutura `.claude/`, e só then avançar para o Sprint 1.

---

## 0. Setup inicial obrigatório

Antes de escrever qualquer código de aplicação, execute:

1. Criar a estrutura de diretório `.claude/` na raiz do repositório, contendo:
   - `.claude/CLAUDE.md` — arquivo mestre de contexto do projeto (instruções permanentes, arquitetura, convenções).
   - `.claude/agents/` — um arquivo `.md` por sub-agente (ver seção 2).
   - `.claude/skills/` — skills reutilizáveis do projeto (ver seção 3).
   - `.claude/sprints/` — um arquivo por sprint, com escopo e critério de "pronto" (Definition of Done).
2. Popular `.claude/CLAUDE.md` com o conteúdo completo das seções 1, 4, 5, 6 e 7 deste documento (modelo de dados, regras de negócio, arquitetura, stack).
3. Configurar `.gitignore` para stack Node.js + variáveis de ambiente (`.env`, `node_modules`, etc.).
4. **Regra permanente de operação**: em nenhum momento o Claude Code (ou qualquer sub-agente) deve preencher lacunas de especificação com suposições. Se durante qualquer sprint surgir uma ambiguidade, contradição, ou informação faltante que não esteja coberta neste documento, o agente CEO deve **parar a execução e formular a pergunta objetiva ao usuário**, listando as opções possíveis quando aplicável. Isso vale para todos os sub-agentes: nenhum deve decidir sozinho sobre modelagem de dados, regra de negócio ou fluxo não especificado — apenas sobre detalhes de implementação técnica (ex.: nome de variável, escolha de biblioteca dentro do já definido).

---

## 1. Visão geral do produto

Sistema SaaS multi-tenant para gestão de almoxarifado de empresas que realizam empréstimo interno de ferramentas.

- **Multi-tenant**: cada empresa-cliente (tenant) tem seus próprios dados isolados, seu próprio usuário Root (administrador da empresa contratante), funcionários, ferramentas, empréstimos, reparos e orçamentos.
- **Super-admin da plataforma**: papel único, do dono do SaaS, com visão sobre todos os tenants, cobrança da plataforma e ativação/desativação de contas de empresas-clientes. É um papel **separado** do Root de cada empresa.
- **Cobrança do tenant**: cada empresa paga uma assinatura (mensal ou anual) via gateway de pagamento, administrada pelo Root da própria empresa.

---

## 2. Arquitetura de sub-agentes (Claude Code)

Um agente CEO orquestra sub-agentes especialistas. Nenhum sub-agente deve iniciar trabalho fora do escopo do sprint corrente sem autorização do CEO.

### 2.1 Agente CEO
- Responsável por: interpretar o sprint corrente, distribuir tarefas aos sub-agentes especialistas, validar entregas antes de considerar o sprint concluído, e **interromper e perguntar ao usuário sempre que houver ambiguidade** (nunca deduzir).
- Ao final de cada sprint, aciona o Agente de Testes antes de declarar o sprint como concluído.
- Mantém o `.claude/CLAUDE.md` atualizado conforme decisões forem tomadas ao longo do desenvolvimento.

### 2.2 Sub-agentes especialistas
| Agente | Escopo |
|---|---|
| `frontend-agent` | React + TypeScript + Vite. Telas descritas na seção 6. Acessibilidade via `title`/tooltip em `onMouseOver` em todos os campos e botões. |
| `backend-agent` | Node.js + Express. API REST, autenticação, regras de negócio, orquestração de `NotificationProvider` e `PaymentProvider`. |
| `database-agent` | PostgreSQL. Decide o ORM/query builder (Prisma, TypeORM, Drizzle ou Knex — decisão técnica delegada a este agente). Responsável por multi-tenancy (isolamento de dados — decidir entre schema por tenant ou coluna `tenant_id` com Row Level Security, documentando a escolha e o porquê no `CLAUDE.md`). |
| `cybersecurity-agent` | Hashing de senha, proteção contra SQL injection/XSS/CSRF, rate limiting no login e no envio de OTP, gestão de sessão/token (JWT ou sessão — decisão técnica do agente, documentada), auditoria de logs de acesso. |
| `payments-agent` | Implementação da interface `PaymentProvider` (ver seção 5.4), começando pela integração inicial que o usuário definir antes do Sprint correspondente. |
| `notifications-agent` | Implementação da interface `NotificationProvider` (ver seção 5.3), começando pela Evolution API + n8n. |
| `tests-agent` | Executado ao final de **cada sprint**. Cobre testes unitários, de integração e, a partir do sprint de telas, testes E2E básicos do fluxo crítico do sprint. Reporta ao CEO um veredito estruturado: `PASS` ou `FAIL` com lista de itens pendentes. Sprint só é considerado encerrado com veredito `PASS`. |

---

## 3. Skills do projeto (`.claude/skills/`)

Criar as seguintes skills reutilizáveis:

- `skill-commenting-standard.md`: padrão obrigatório de comentário de cabeçalho em **todo** arquivo de código — finalidade do script, como funciona (resumo), e com quais outros módulos/classes se relaciona. Comentários em português, identificadores de código (variáveis, funções, classes) em inglês — mantendo o padrão já usado nos demais projetos do usuário.
- `skill-multitenancy.md`: regras de isolamento de dados entre tenants, a serem seguidas por todo endpoint da API.
- `skill-status-machine-ferramenta.md`: documentação da máquina de estados do status da ferramenta (seção 4.6), incluindo quais transições são válidas e qual agente/endpoint pode disparar cada uma.

---

## 4. Modelo de dados consolidado

> Todas as classes abaixo pertencem a um tenant (`tenant_id` ou equivalente, conforme decisão do `database-agent`), exceto a entidade de nível de plataforma (Super-admin/Tenant).

### 4.1 Tenant (empresa-cliente)
- `id` (gerado automaticamente)
- Dados cadastrais da empresa
- Status de assinatura (ver 5.4)
- Um Tenant tem um usuário Root associado.

### 4.2 Funcionário
- `id` (gerado automaticamente)
- `nome`
- `data_cadastro`
- `numero_telefone`
- `data_admissao`
- `status_almoxarife` (booleano)
- `senha` (obrigatória/exigida somente quando `status_almoxarife = true`; nula/não exigida enquanto o funcionário for apenas depositário sem login)

**Métodos**: cadastrar funcionário, excluir funcionário, editar dados do funcionário, promover a almoxarife (ação exclusiva do Root, que dispara a exigência de criação de senha).

### 4.3 Prestador de serviço
- `id` (gerado automaticamente)
- `nome`
- `endereço`
- `telefone`
- `id_funcionario` (nullable, FK para Funcionário) — quando preenchido, indica que este "prestador" é na verdade um funcionário interno da empresa; nesse caso, o reparo vinculado a ele deve ser roteado para a classe `ReparosInternos`, e não `ReparosExternos`, mesmo tendo sido cadastrado pela tela de prestador.
- Sem login próprio — apenas registro cadastrado pelo almoxarife.

### 4.4 Ferramenta
- `id` (gerado automaticamente)
- `tipo` (string: manual, elétrica, pneumática, etc.)
- `descrição` (string)
- `marca` (string)
- `status` — ver enum na seção 4.6

**Métodos**: cadastrar ferramenta, enviar para reparo, retornar do reparo, sucatear.

### 4.5 Empréstimo
- `id` (gerado automaticamente)
- `id_ferramenta` (FK — **adicionado**, ausente na especificação original)
- `data_saida`
- `data_retorno`
- `id_depositario` (FK Funcionário)
- `id_funcionario_emprestador` (FK Funcionário, deve ter `status_almoxarife = true`)

**Métodos**: realizar empréstimo, encerrar empréstimo.

**Regras aplicadas**:
- Um depositário pode ter várias ferramentas simultaneamente em sua custódia.
- Uma ferramenta só pode estar vinculada a um empréstimo ativo (um depositário) por vez.
- Só pode ser encerrado um empréstimo que esteja ativo.
- Ao encerrar, a ferramenta retorna para status `disponível`.

### 4.6 Status da ferramenta (enum — validado literalmente pelo usuário)

```
disponivel
alugada
aguardando_orcamento
aguardando_liberacao
em_reparo
aguardando_devolucao
sucateada
```

**Transições**:
- `disponivel` → `alugada` (ao realizar empréstimo)
- `alugada` → `disponivel` (ao encerrar empréstimo)
- `disponivel` → `aguardando_orcamento` (ao enviar para reparo — só permitido se estiver `disponivel`)
- `aguardando_orcamento` → `aguardando_liberacao` (ao cadastrar orçamento)
- `aguardando_liberacao` → `em_reparo` (orçamento aprovado)
- `aguardando_liberacao` → `aguardando_orcamento` (orçamento recusado — retorna para aguardar novo orçamento; o orçamento recusado é mantido na base para análise posterior, não é excluído)
- `em_reparo` → `aguardando_devolucao` (reparo concluído, aguardando conferência/retorno ao estoque)
- `aguardando_devolucao` → `disponivel` (ferramenta retorna do reparo)
- Qualquer status (exceto `alugada`) → `sucateada` (ação de sucatear)

### 4.7 ReparosExternos
- `id` (gerado automaticamente)
- `id_ferramenta` (FK)
- `id_funcionario_requisitante` (FK)
- `data_inicio`, `data_fim`
- `descricao_reparo_realizado`
- `id_orcamento` (FK)
- `id_prestador` (FK — obrigatoriamente um prestador com `id_funcionario = null`, ou seja, um terceiro genuinamente externo)

**Métodos**: iniciar reparo, encerrar reparo.

### 4.8 ReparosInternos
- `id` (gerado automaticamente)
- `id_funcionario_requisitante` (FK)
- `id_funcionario_responsavel` (FK — funcionário que executa o reparo)
- `id_ferramenta` (FK)
- `data_inicio`, `data_fim`
- `descricao_reparo_realizado` (**adicionado** — ausente na especificação original)
- `id_orcamento` (FK, nullable — reparo interno pode ou não precisar de orçamento, dependendo de necessidade de compra de peças)

**Métodos**: iniciar reparo, encerrar reparo.

**Roteamento**: quando o reparo é cadastrado a partir de um `Prestador` cujo `id_funcionario` está preenchido, o registro deve ser gravado em `ReparosInternos` (não em `ReparosExternos`), com `id_funcionario_responsavel` = o funcionário vinculado ao prestador.

### 4.9 Orçamento
- `id` (gerado automaticamente)
- `id_ferramenta` (FK)
- `id_prestador` (FK)
- `tipo_reparo` (externo | interno — **derivado** de `Prestador.id_funcionario`: nulo → externo; preenchido → interno. Não deve ser um campo de escolha livre no formulário.)
- `data_cadastro`
- `descricao_servico`
- `valor_orcamento`
- `status` (liberado | recusado | pendente)

**Métodos**: cadastrar orçamento, editar orçamento.

**Regra**: orçamento recusado permanece na base de dados para análise histórica; não é excluído.

---

## 5. Regras de negócio, autenticação, pagamento e notificação

### 5.1 Regras de negócio (consolidadas, numeração da especificação original + ajustes)

1. Uma ferramenta só pode ter um depositário por aluguel ativo.
2. Um depositário obrigatoriamente deve ser um funcionário cadastrado.
3. Quem realiza o empréstimo deve ser um funcionário com `status_almoxarife = true`.
4. Um depositário pode ter vários empréstimos simultâneos (várias ferramentas em custódia ao mesmo tempo); cada ferramenta individual só pode estar em um empréstimo ativo por vez.
5. O usuário Root da empresa tem permissão para atribuir a um funcionário o status de almoxarife, e também pode cadastrar diretamente um novo funcionário.
6. Funcionário com status de almoxarife tem permissão para cadastrar os demais funcionários.
7. O primeiro almoxarife de cada empresa é obrigatoriamente cadastrado pelo Root.
8. Uma ferramenta só pode ser emprestada se o status for `disponivel`.
9. Ferramentas com status `alugada`, `aguardando_orcamento`, `aguardando_liberacao`, `em_reparo`, `aguardando_devolucao` e `sucateada` estão indisponíveis para empréstimo.
10. Uma ferramenta só é enviada para reparo efetivo (`em_reparo`) após orçamento aprovado — exceto reparo interno sem necessidade de peças, que pode dispensar orçamento.
11. Reparo interno pode ou não necessitar aprovação de orçamento, conforme necessidade de compra de peças.
12. Orçamento recusado é mantido na base para análise posterior de dados.
13. Reparo externo é obrigatoriamente feito por um prestador com `id_funcionario = null`; reparo com prestador que tem `id_funcionario` preenchido é tratado como reparo interno.
14. Só pode ser encerrado um empréstimo que esteja ativo.
15. Uma ferramenta só pode ser enviada para reparo se estiver com status `disponivel`.
16. Ao encerrar um empréstimo, a ferramenta volta para status `disponivel`.
17. Ao retornar de um reparo (`aguardando_devolucao` → `disponivel`), a ferramenta volta para status `disponivel`.
18. Ao enviar uma ferramenta para reparo, um orçamento deve ser cadastrado antes do reparo ser autorizado (fluxo: `aguardando_orcamento` → `aguardando_liberacao` → `em_reparo`).
19. Um orçamento pode ser editado.
20. Orçamento recusado retorna a ferramenta para o status `aguardando_orcamento` (aguardando novo orçamento).

### 5.2 Autenticação
- Login por telefone + senha (senha exigida apenas para funcionários com `status_almoxarife = true`; depositários sem esse status não têm login).
- Segundo fator de autenticação (2FA): código enviado via WhatsApp após validação da senha.
- Após 2FA bem-sucedido, verificar status de pagamento da assinatura do tenant antes de liberar as funcionalidades:
  - Se pagamento regular → libera acesso.
  - Se pagamento atrasado → bloquear com a mensagem: **"acesso bloqueado, contatar suporte"**.
- Gestão e regularização do pagamento é responsabilidade exclusiva do Root de cada empresa-tenant.

### 5.3 Interface `NotificationProvider`

Abstração no backend para desacoplar a lógica de negócio do canal de envio de notificações (incluindo o código de 2FA).

```
interface NotificationProvider {
  sendMessage(destinatario: string, mensagem: string, tipo: 'otp' | 'geral'): Promise<ResultadoEnvio>
}
```

- **Implementação inicial (Sprint correspondente)**: Evolution API + n8n, cobrindo tanto notificações não-críticas quanto o envio do código de 2FA.
- **Decisão de arquitetura registrada**: usar Evolution API para 2FA no início é uma dívida técnica aceita conscientemente pelo usuário (risco de indisponibilidade do canal não-oficial), em troca de custo zero e reaproveitamento de infraestrutura já existente.
- **Gatilho de migração para BSP oficial (Twilio ou 360dialog)**: quando o número de empresas-clientes ativas no SaaS atingir **10 (dez) tenants**. Documentar esse critério de forma visível no `CLAUDE.md` e criar um item de backlog/lembrete técnico associado a esse gatilho.
- A troca de implementação não deve exigir alteração na lógica de negócio que consome `NotificationProvider` — apenas troca da classe concreta injetada.

### 5.4 Interface `PaymentProvider`

Abstração modular para gateway de pagamento, permitindo acoplar Stripe, Mercado Pago ou outro sem reescrever a lógica de negócio de cobrança.

```
interface PaymentProvider {
  createSubscription(tenantId, plano: 'mensal' | 'anual'): Promise<Assinatura>
  checkPaymentStatus(tenantId): Promise<'regular' | 'atrasado'>
  cancelSubscription(tenantId): Promise<void>
}
```

- Classe `Assinatura`/`Pagamento` (a ser adicionada ao modelo de dados pelo `database-agent`) deve conter, no mínimo: `id`, `tenant_id`, `plano`, `status`, `data_inicio`, `data_proximo_vencimento`, `provider_usado`.
- **Pendência aberta**: qual gateway será implementado primeiro (Stripe, Mercado Pago ou outro) não foi definida até o fechamento deste documento. O agente CEO deve perguntar ao usuário antes de iniciar o sprint de pagamentos, e não presumir.

---

## 6. Telas

Design limpo, intuitivo, com tooltip (`title`/`onMouseOver`) explicando a finalidade de cada campo e botão.

1. **Login**: telefone + senha → tela de verificação de código (2FA via WhatsApp).
2. **Cadastrar** (funcionário ou prestador): inclui busca por nome de funcionário ou prestador já cadastrado.
3. **Emprestar**: busca de ferramenta e de funcionário (depositário) → registrar empréstimo.
4. **Ferramentas**: cadastrar, enviar para reparo, sucatear; busca de ferramenta; busca de prestador para reparo; cadastro de reparo (fluxo de status `aguardando_orcamento` → `aguardando_liberacao` → `em_reparo` → `aguardando_devolucao` conforme seção 4.6).

**Pendência aberta**: nenhuma tela de administração de assinatura/pagamento (para o Root) nem tela de painel do super-admin da plataforma foi detalhada na especificação original. O agente CEO deve perguntar ao usuário o escopo dessas telas antes do sprint correspondente.

---

## 7. Análises de dados (relatórios)

1. Ferramentas disponíveis.
2. Ferramentas alugadas e dias decorridos desde o início do aluguel.
3. Ferramentas aguardando orçamento, com orçamento recusado, ou com orçamento liberado.
4. Ferramentas em reparo e aguardando devolução.
5. Valor total gasto em reparos por ferramenta.
6. Ferramentas sucateadas.
7. Dias totais de empréstimo e de reparo por ferramenta.
8. Relação de ferramentas com empréstimos em aberto, por funcionário (depositário).

---

## 8. Divisão em Sprints (proposta inicial — sujeita a ajuste pelo agente CEO)

> Cada sprint termina com execução obrigatória do `tests-agent` e veredito PASS/FAIL antes de avançar.

- **Sprint 0**: Setup do repositório, `.claude/`, estrutura de projeto (frontend/backend), configuração de banco de dados e estratégia de multi-tenancy.
- **Sprint 1**: Modelo de dados completo (todas as classes da seção 4) + migrations.
- **Sprint 2**: Autenticação (login + senha + 2FA via `NotificationProvider`/Evolution API) + gestão de sessão/token.
- **Sprint 3**: CRUD de Funcionário, Prestador, e regras de promoção a almoxarife (Root).
- **Sprint 4**: CRUD de Ferramenta + máquina de estados de status (seção 4.6).
- **Sprint 5**: Fluxo de Empréstimo (realizar/encerrar).
- **Sprint 6**: Fluxo de Reparo (Orçamento, ReparosExternos, ReparosInternos, roteamento automático por `Prestador.id_funcionario`).
- **Sprint 7**: Telas de front-end (seção 6) integradas ao backend.
- **Sprint 8**: Relatórios/análise de dados (seção 7).
- **Sprint 9**: `PaymentProvider` — **requer definição prévia do gateway inicial pelo usuário antes de iniciar**.
- **Sprint 10**: Testes end-to-end completos, hardening de segurança (`cybersecurity-agent`), preparação para deploy.
- **Sprint 11**: Migração/deploy para VPS Hostinger (ambiente de produção).

---

## 9. Pendências que o agente CEO deve levantar com o usuário antes de iniciar os sprints correspondentes

- Gateway de pagamento a ser implementado primeiro (Sprint 9).
- Escopo das telas de administração de assinatura (Root) e painel do super-admin da plataforma (Sprint 7/9).
- Estratégia técnica de isolamento multi-tenant (schema por tenant vs. `tenant_id` + RLS) — decisão do `database-agent`, mas deve ser validada com o usuário antes de aplicar em produção, dado o impacto estrutural.
- ORM/query builder — decisão do `database-agent`, documentar no `CLAUDE.md` assim que definido.

---

## 10. Instrução final para o Claude Code

Ao final de cada sprint, gerar/atualizar:
- `.claude/CLAUDE.md` com decisões técnicas tomadas.
- `README.md` do repositório, contendo: stack utilizada, instruções de setup local, e um manual de uso do aplicativo por perfil de usuário (Root, Almoxarife, Depositário, Super-admin).

Não avançar para o próximo sprint sem veredito `PASS` do `tests-agent` e sem confirmação do agente CEO de que não há pendências de esclarecimento em aberto para aquele sprint.
