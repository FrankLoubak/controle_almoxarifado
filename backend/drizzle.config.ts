/**
 * Finalidade: configuração do Drizzle Kit (geração/aplicação de migrations).
 * Como funciona: aponta para o schema em src/db/schema e para o Postgres via DATABASE_URL.
 * Relações: usado pelos scripts db:generate e db:migrate; o schema é populado no Sprint 1.
 */
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/*",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
