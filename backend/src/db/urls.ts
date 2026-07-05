/**
 * Finalidade: resolver as URLs de conexão do Postgres (migração vs aplicação).
 * Como funciona: lê env; em dev cai nos defaults do docker-compose (host 5433).
 *   MIGRATION_URL = dono (superuser, aplica DDL). APP_URL = role almox_app (sujeita ao RLS).
 * Relações: usado por client.ts, migrate.ts, seed.ts e pelos testes de RLS. Ver D15.
 */
export const MIGRATION_URL =
  process.env.MIGRATION_DATABASE_URL ??
  "postgres://almox:almox_dev@localhost:5433/almoxarifado";

export const APP_URL =
  process.env.DATABASE_URL ??
  "postgres://almox_app:almox_app_dev@localhost:5433/almoxarifado";
