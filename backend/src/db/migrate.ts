/**
 * Finalidade: aplicar as migrations do Drizzle no banco (conexão do dono).
 * Como funciona: usa o migrator do drizzle-orm (lê drizzle/_journal.json e roda os .sql
 *   pendentes) com a MIGRATION_URL (superuser), pois cria role e altera RLS.
 * Relações: consome ./drizzle (migrations geradas) e urls.ts. Rodar via `npm run db:migrate`.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { MIGRATION_URL } from "./urls";

const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: MIGRATION_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  // eslint-disable-next-line no-console
  console.log("migrations aplicadas com sucesso");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("falha ao aplicar migrations:", err);
  process.exit(1);
});
