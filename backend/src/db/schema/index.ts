/**
 * Finalidade: ponto único de re-export do schema (enums + tabelas).
 * Como funciona: reexporta tudo de enums.ts e tables.ts para import conveniente.
 * Relações: consumido por drizzle.config.ts, client.ts, migrate.ts, seed.ts e serviços.
 */
export * from "./enums";
export * from "./tables";
