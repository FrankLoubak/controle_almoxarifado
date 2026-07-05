CREATE TYPE "public"."assinatura_status" AS ENUM('regular', 'atrasado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."orcamento_status" AS ENUM('pendente', 'liberado', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."plano_assinatura" AS ENUM('mensal', 'anual');--> statement-breakpoint
CREATE TYPE "public"."tipo_reparo" AS ENUM('externo', 'interno');--> statement-breakpoint
CREATE TYPE "public"."tool_status" AS ENUM('disponivel', 'alugada', 'aguardando_orcamento', 'aguardando_liberacao', 'em_reparo', 'aguardando_devolucao', 'sucateada');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assinaturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plano" "plano_assinatura" NOT NULL,
	"status" "assinatura_status" DEFAULT 'regular' NOT NULL,
	"data_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"data_proximo_vencimento" timestamp with time zone NOT NULL,
	"provider_usado" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assinaturas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emprestimos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"id_ferramenta" uuid NOT NULL,
	"data_saida" timestamp with time zone DEFAULT now() NOT NULL,
	"data_retorno" timestamp with time zone,
	"id_depositario" uuid NOT NULL,
	"id_funcionario_emprestador" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emprestimos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ferramentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"descricao" text,
	"marca" text,
	"status" "tool_status" DEFAULT 'disponivel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ferramentas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funcionarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"numero_telefone" text NOT NULL,
	"cpf" text,
	"email" text,
	"data_admissao" date,
	"data_cadastro" timestamp with time zone DEFAULT now() NOT NULL,
	"status_almoxarife" boolean DEFAULT false NOT NULL,
	"is_root" boolean DEFAULT false NOT NULL,
	"senha_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "funcionarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orcamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"id_ferramenta" uuid NOT NULL,
	"id_prestador" uuid NOT NULL,
	"tipo_reparo" "tipo_reparo" NOT NULL,
	"data_cadastro" timestamp with time zone DEFAULT now() NOT NULL,
	"descricao_servico" text,
	"valor_orcamento" numeric(12, 2) NOT NULL,
	"status" "orcamento_status" DEFAULT 'pendente' NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orcamentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prestadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"endereco" text,
	"telefone" text,
	"id_funcionario" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "prestadores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reparos_externos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"id_ferramenta" uuid NOT NULL,
	"id_funcionario_requisitante" uuid NOT NULL,
	"id_prestador" uuid NOT NULL,
	"id_orcamento" uuid NOT NULL,
	"data_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"data_fim" timestamp with time zone,
	"descricao_reparo_realizado" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reparos_externos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reparos_internos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"id_ferramenta" uuid NOT NULL,
	"id_funcionario_requisitante" uuid NOT NULL,
	"id_funcionario_responsavel" uuid NOT NULL,
	"id_orcamento" uuid,
	"data_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"data_fim" timestamp with time zone,
	"descricao_reparo_realizado" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reparos_internos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "super_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "super_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"razao_social" text NOT NULL,
	"cnpj" text NOT NULL,
	"email" text NOT NULL,
	"telefone" text NOT NULL,
	"endereco" text,
	"status_assinatura" "assinatura_status" DEFAULT 'regular' NOT NULL,
	"id_root_funcionario" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tenants_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_id_ferramenta_ferramentas_id_fk" FOREIGN KEY ("id_ferramenta") REFERENCES "public"."ferramentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_id_depositario_funcionarios_id_fk" FOREIGN KEY ("id_depositario") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emprestimos" ADD CONSTRAINT "emprestimos_id_funcionario_emprestador_funcionarios_id_fk" FOREIGN KEY ("id_funcionario_emprestador") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_id_ferramenta_ferramentas_id_fk" FOREIGN KEY ("id_ferramenta") REFERENCES "public"."ferramentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_id_prestador_prestadores_id_fk" FOREIGN KEY ("id_prestador") REFERENCES "public"."prestadores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prestadores" ADD CONSTRAINT "prestadores_id_funcionario_funcionarios_id_fk" FOREIGN KEY ("id_funcionario") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_externos" ADD CONSTRAINT "reparos_externos_id_ferramenta_ferramentas_id_fk" FOREIGN KEY ("id_ferramenta") REFERENCES "public"."ferramentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_externos" ADD CONSTRAINT "reparos_externos_id_funcionario_requisitante_funcionarios_id_fk" FOREIGN KEY ("id_funcionario_requisitante") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_externos" ADD CONSTRAINT "reparos_externos_id_prestador_prestadores_id_fk" FOREIGN KEY ("id_prestador") REFERENCES "public"."prestadores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_externos" ADD CONSTRAINT "reparos_externos_id_orcamento_orcamentos_id_fk" FOREIGN KEY ("id_orcamento") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_internos" ADD CONSTRAINT "reparos_internos_id_ferramenta_ferramentas_id_fk" FOREIGN KEY ("id_ferramenta") REFERENCES "public"."ferramentas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_internos" ADD CONSTRAINT "reparos_internos_id_funcionario_requisitante_funcionarios_id_fk" FOREIGN KEY ("id_funcionario_requisitante") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_internos" ADD CONSTRAINT "reparos_internos_id_funcionario_responsavel_funcionarios_id_fk" FOREIGN KEY ("id_funcionario_responsavel") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reparos_internos" ADD CONSTRAINT "reparos_internos_id_orcamento_orcamentos_id_fk" FOREIGN KEY ("id_orcamento") REFERENCES "public"."orcamentos"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenants" ADD CONSTRAINT "tenants_id_root_funcionario_funcionarios_id_fk" FOREIGN KEY ("id_root_funcionario") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_emprestimo_ferramenta_ativo" ON "emprestimos" USING btree ("id_ferramenta") WHERE "emprestimos"."data_retorno" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_telefone_global" ON "funcionarios" USING btree ("numero_telefone") WHERE "funcionarios"."deleted_at" IS NULL;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "assinaturas" AS PERMISSIVE FOR ALL TO public USING ("assinaturas"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("assinaturas"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "emprestimos" AS PERMISSIVE FOR ALL TO public USING ("emprestimos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("emprestimos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ferramentas" AS PERMISSIVE FOR ALL TO public USING ("ferramentas"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("ferramentas"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "funcionarios" AS PERMISSIVE FOR ALL TO public USING ("funcionarios"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("funcionarios"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "orcamentos" AS PERMISSIVE FOR ALL TO public USING ("orcamentos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("orcamentos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "prestadores" AS PERMISSIVE FOR ALL TO public USING ("prestadores"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("prestadores"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "reparos_externos" AS PERMISSIVE FOR ALL TO public USING ("reparos_externos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("reparos_externos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "reparos_internos" AS PERMISSIVE FOR ALL TO public USING ("reparos_internos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("reparos_internos"."tenant_id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_self_isolation" ON "tenants" AS PERMISSIVE FOR ALL TO public USING ("tenants"."id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid) WITH CHECK ("tenants"."id" = NULLIF(current_setting('app.current_tenant', true), '')::uuid);