/**
 * Finalidade: schema Drizzle de todas as entidades do almoxarifado (CLAUDE.md seção 4).
 * Como funciona: define as tabelas Postgres com PK uuid, timestamps, soft-delete e
 *   isolamento multi-tenant via coluna tenant_id + políticas RLS (current_setting
 *   'app.current_tenant'). Tabelas de nível de plataforma (super_admins) não têm tenant_id.
 * Relações: usa os enums de enums.ts; consumido por index.ts, client.ts, migrate.ts e
 *   pelos serviços de negócio (a partir do Sprint 3). RLS descrito em
 *   .claude/skills/skill-multitenancy.md.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  assinaturaStatusEnum,
  orcamentoStatusEnum,
  planoEnum,
  tipoReparoEnum,
  toolStatusEnum,
} from "./enums";

// ── Helpers de colunas comuns ────────────────────────────────────────────────

const pk = () => uuid("id").primaryKey().defaultRandom();

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Soft-delete (D9): registros nunca são apagados fisicamente.
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });

// Coluna de tenant + política RLS reutilizável (skill-multitenancy).
const tenantId = () => uuid("tenant_id").notNull();

// Política de isolamento por tenant: só enxerga/escreve linhas do tenant corrente.
// NULLIF(..., '') trata GUC ausente/vazio como NULL → comparação NULL nega acesso sem
// erro de cast (o reset de um GUC customizado após SET LOCAL vira '' em vez de NULL).
const tenantExpr = sql`NULLIF(current_setting('app.current_tenant', true), '')::uuid`;

const tenantPolicy = (col: AnyPgColumn) =>
  pgPolicy("tenant_isolation", {
    for: "all",
    using: sql`${col} = ${tenantExpr}`,
    withCheck: sql`${col} = ${tenantExpr}`,
  });

// ── Nível de plataforma ──────────────────────────────────────────────────────

// Super-admin da plataforma (CLAUDE.md 4.11). Campos de 2FA entram no Sprint 2.
// Sem política: RLS habilitado nega acesso à role de aplicação (o login usa a função
// SECURITY DEFINER auth_lookup_super_admin — D18). Campos TOTP para 2FA (D16).
export const superAdmins = pgTable("super_admins", {
  id: pk(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  totpSecret: text("totp_secret"), // segredo TOTP cifrado (base32); null até habilitar 2FA
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  ...timestamps(),
}).enableRLS();

// Tenant / empresa-cliente (CLAUDE.md 4.1). É isolado por seu próprio id.
export const tenants = pgTable(
  "tenants",
  {
    id: pk(),
    razaoSocial: text("razao_social").notNull(),
    cnpj: text("cnpj").notNull().unique(),
    email: text("email").notNull(),
    telefone: text("telefone").notNull(),
    endereco: text("endereco"),
    statusAssinatura: assinaturaStatusEnum("status_assinatura").notNull().default("regular"),
    // FK nullable → Funcionário com is_root=true (D14). Preenchido após criar o Root.
    idRootFuncionario: uuid("id_root_funcionario").references((): AnyPgColumn => funcionarios.id),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [
    pgPolicy("tenant_self_isolation", {
      for: "all",
      using: sql`${t.id} = ${tenantExpr}`,
      withCheck: sql`${t.id} = ${tenantExpr}`,
    }),
  ],
);

// Assinatura/Pagamento do tenant (CLAUDE.md 4.10). Escopada por tenant_id.
export const assinaturas = pgTable(
  "assinaturas",
  {
    id: pk(),
    tenantId: tenantId(),
    plano: planoEnum("plano").notNull(),
    status: assinaturaStatusEnum("status").notNull().default("regular"),
    dataInicio: timestamp("data_inicio", { withTimezone: true }).notNull().defaultNow(),
    dataProximoVencimento: timestamp("data_proximo_vencimento", { withTimezone: true }).notNull(),
    providerUsado: text("provider_usado").notNull(),
    ...timestamps(),
  },
  (t) => [tenantPolicy(t.tenantId)],
);

// ── Entidades operacionais (por tenant) ──────────────────────────────────────

// Funcionário (CLAUDE.md 4.2). Root = is_root. Depositário não tem senha.
export const funcionarios = pgTable(
  "funcionarios",
  {
    id: pk(),
    tenantId: tenantId(),
    nome: text("nome").notNull(),
    numeroTelefone: text("numero_telefone").notNull(), // único global (D2) — índice na migration
    cpf: text("cpf"),
    email: text("email"),
    dataAdmissao: date("data_admissao"),
    dataCadastro: timestamp("data_cadastro", { withTimezone: true }).notNull().defaultNow(),
    statusAlmoxarife: boolean("status_almoxarife").notNull().default(false),
    isRoot: boolean("is_root").notNull().default(false), // D14
    senhaHash: text("senha_hash"), // exigida só quando status_almoxarife=true
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [
    tenantPolicy(t.tenantId),
    // Telefone único GLOBAL (D2); parcial para permitir reuso após soft-delete.
    uniqueIndex("uq_funcionario_telefone_global")
      .on(t.numeroTelefone)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

// Prestador de serviço (CLAUDE.md 4.3). id_funcionario preenchido → reparo interno.
export const prestadores = pgTable(
  "prestadores",
  {
    id: pk(),
    tenantId: tenantId(),
    nome: text("nome").notNull(),
    endereco: text("endereco"),
    telefone: text("telefone"),
    idFuncionario: uuid("id_funcionario").references(() => funcionarios.id),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [tenantPolicy(t.tenantId)],
);

// Ferramenta (CLAUDE.md 4.4). status segue a máquina de estados (4.6).
export const ferramentas = pgTable(
  "ferramentas",
  {
    id: pk(),
    tenantId: tenantId(),
    tipo: text("tipo").notNull(),
    descricao: text("descricao"),
    marca: text("marca"),
    status: toolStatusEnum("status").notNull().default("disponivel"),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [tenantPolicy(t.tenantId)],
);

// Empréstimo (CLAUDE.md 4.5). Ativo = data_retorno IS NULL.
export const emprestimos = pgTable(
  "emprestimos",
  {
    id: pk(),
    tenantId: tenantId(),
    idFerramenta: uuid("id_ferramenta").notNull().references(() => ferramentas.id),
    dataSaida: timestamp("data_saida", { withTimezone: true }).notNull().defaultNow(),
    dataRetorno: timestamp("data_retorno", { withTimezone: true }),
    idDepositario: uuid("id_depositario").notNull().references(() => funcionarios.id),
    idFuncionarioEmprestador: uuid("id_funcionario_emprestador")
      .notNull()
      .references(() => funcionarios.id),
    ...timestamps(),
  },
  (t) => [
    tenantPolicy(t.tenantId),
    // Regra 1/4: uma ferramenta só pode ter um empréstimo ATIVO (data_retorno IS NULL).
    uniqueIndex("uq_emprestimo_ferramenta_ativo")
      .on(t.idFerramenta)
      .where(sql`${t.dataRetorno} IS NULL`),
  ],
);

// Orçamento (CLAUDE.md 4.9). Recusado é mantido na base (regra 12).
export const orcamentos = pgTable(
  "orcamentos",
  {
    id: pk(),
    tenantId: tenantId(),
    idFerramenta: uuid("id_ferramenta").notNull().references(() => ferramentas.id),
    idPrestador: uuid("id_prestador").notNull().references(() => prestadores.id),
    tipoReparo: tipoReparoEnum("tipo_reparo").notNull(), // derivado de Prestador.id_funcionario
    dataCadastro: timestamp("data_cadastro", { withTimezone: true }).notNull().defaultNow(),
    descricaoServico: text("descricao_servico"),
    valorOrcamento: numeric("valor_orcamento", { precision: 12, scale: 2 }).notNull(),
    status: orcamentoStatusEnum("status").notNull().default("pendente"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }), // D13 (sucatear cancela)
    ...timestamps(),
  },
  (t) => [tenantPolicy(t.tenantId)],
);

// Reparo externo (CLAUDE.md 4.7). Prestador obrigatoriamente externo (id_funcionario NULL).
export const reparosExternos = pgTable(
  "reparos_externos",
  {
    id: pk(),
    tenantId: tenantId(),
    idFerramenta: uuid("id_ferramenta").notNull().references(() => ferramentas.id),
    idFuncionarioRequisitante: uuid("id_funcionario_requisitante")
      .notNull()
      .references(() => funcionarios.id),
    idPrestador: uuid("id_prestador").notNull().references(() => prestadores.id),
    idOrcamento: uuid("id_orcamento").notNull().references(() => orcamentos.id),
    dataInicio: timestamp("data_inicio", { withTimezone: true }).notNull().defaultNow(),
    dataFim: timestamp("data_fim", { withTimezone: true }),
    descricaoReparoRealizado: text("descricao_reparo_realizado"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }), // D13
    ...timestamps(),
  },
  (t) => [tenantPolicy(t.tenantId)],
);

// Reparo interno (CLAUDE.md 4.8). Orçamento opcional (regra 11).
export const reparosInternos = pgTable(
  "reparos_internos",
  {
    id: pk(),
    tenantId: tenantId(),
    idFerramenta: uuid("id_ferramenta").notNull().references(() => ferramentas.id),
    idFuncionarioRequisitante: uuid("id_funcionario_requisitante")
      .notNull()
      .references(() => funcionarios.id),
    idFuncionarioResponsavel: uuid("id_funcionario_responsavel")
      .notNull()
      .references(() => funcionarios.id),
    idOrcamento: uuid("id_orcamento").references(() => orcamentos.id), // nullable
    dataInicio: timestamp("data_inicio", { withTimezone: true }).notNull().defaultNow(),
    dataFim: timestamp("data_fim", { withTimezone: true }),
    descricaoReparoRealizado: text("descricao_reparo_realizado"),
    canceledAt: timestamp("canceled_at", { withTimezone: true }), // D13
    ...timestamps(),
  },
  (t) => [tenantPolicy(t.tenantId)],
);

// ── Autenticação (nível de plataforma — sem RLS de tenant; acesso via role de app) ──

// Desafio de OTP (2FA por WhatsApp) para funcionários (CLAUDE.md 5.2, D6/D18).
// Sem RLS de tenant: o desafio é criado/consultado no login, antes do tenant estar fixado.
export const otpChallenges = pgTable("otp_challenges", {
  id: pk(),
  funcionarioId: uuid("funcionario_id").notNull().references(() => funcionarios.id),
  tenantId: uuid("tenant_id").notNull(), // guardado para fixar o tenant após o 2FA
  codeHash: text("code_hash").notNull(), // hash do OTP (nunca o código em claro)
  purpose: text("purpose").notNull().default("login_2fa"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5), // D6
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // +5min (D6)
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Refresh tokens (JWT de sessão) — revogáveis (D5). Serve funcionário e super-admin.
export const refreshTokens = pgTable("refresh_tokens", {
  id: pk(),
  subjectType: text("subject_type").notNull(), // 'funcionario' | 'super_admin'
  subjectId: uuid("subject_id").notNull(),
  tokenHash: text("token_hash").notNull(), // hash do refresh token (nunca em claro)
  // Snapshot das claims do access token, para re-emitir no /refresh sem novo lookup.
  claims: jsonb("claims").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // +7 dias (D5)
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
