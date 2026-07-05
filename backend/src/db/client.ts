/**
 * Finalidade: cliente Drizzle da aplicação (conexão sujeita ao RLS) + helper withTenant.
 * Como funciona: cria um pool com a role almox_app (APP_URL) e expõe withTenant, que abre
 *   uma transação, fixa app.current_tenant via set_config(local) e roda a callback — todo
 *   acesso fica escopado ao tenant corrente pelas políticas RLS.
 * Relações: usa schema/index e urls.ts; consumido pelos serviços de negócio (Sprint 3+).
 *   Regras de isolamento em .claude/skills/skill-multitenancy.md.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";
import { APP_URL } from "./urls";

const { Pool } = pg;

export const pool = new Pool({ connectionString: APP_URL });
export const db = drizzle(pool, { schema });

// Tipo da instância transacional entregue pela callback de db.transaction.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Executa `fn` com o tenant corrente fixado na sessão (RLS ativo).
 * set_config(..., true) mantém o parâmetro local à transação — nunca vaza entre requests.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_tenant', ${tenantId}, true)`);
    return fn(tx);
  });
}
