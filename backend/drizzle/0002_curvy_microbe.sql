CREATE TABLE IF NOT EXISTS "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funcionario_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text DEFAULT 'login_2fa' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "super_admins" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "super_admins" ADD COLUMN "totp_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
