/**
 * Finalidade: teste de integração do isolamento multi-tenant (RLS) — fluxo crítico do Sprint 1.
 * Como funciona: cria dois tenants (A e B) e uma ferramenta em cada via conexão do dono
 *   (superuser); depois, pela conexão da aplicação (role almox_app + withTenant), verifica
 *   que cada tenant só enxerga os próprios dados e que a política WITH CHECK barra inserção
 *   cruzada. Requer o Postgres do docker-compose e as migrations aplicadas.
 * Relações: exercita client.ts (withTenant), schema/tables (políticas RLS) e a migration
 *   0001 (FORCE RLS + role almox_app). Ver .claude/skills/skill-multitenancy.md.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool, withTenant } from "../client";
import { ferramentas } from "../schema/index";
import { MIGRATION_URL } from "../urls";

const { Pool } = pg;
const owner = new Pool({ connectionString: MIGRATION_URL });

let tenantA: string;
let tenantB: string;
const cnpjA = randomUUID().replace(/\D/g, "").padEnd(14, "0").slice(0, 14);
const cnpjB = randomUUID().replace(/\D/g, "").padEnd(14, "0").slice(0, 14);

async function createTenant(cnpj: string): Promise<string> {
  const r = await owner.query(
    `INSERT INTO tenants (razao_social, cnpj, email, telefone)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [`Tenant ${cnpj}`, cnpj, `t${cnpj}@x.local`, "+550000000000"],
  );
  return r.rows[0].id as string;
}

beforeAll(async () => {
  tenantA = await createTenant(cnpjA);
  tenantB = await createTenant(cnpjB);
  // Uma ferramenta em cada tenant (inserida pelo dono, que ignora RLS).
  await owner.query(`INSERT INTO ferramentas (tenant_id, tipo, marca) VALUES ($1,$2,$3)`, [
    tenantA,
    "manual",
    "MarcaA",
  ]);
  await owner.query(`INSERT INTO ferramentas (tenant_id, tipo, marca) VALUES ($1,$2,$3)`, [
    tenantB,
    "eletrica",
    "MarcaB",
  ]);
});

afterAll(async () => {
  await owner.query(`DELETE FROM ferramentas WHERE tenant_id = ANY($1::uuid[])`, [
    [tenantA, tenantB],
  ]);
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
  await owner.end();
  await pool.end();
});

describe("RLS multi-tenant", () => {
  it("tenant A só enxerga as próprias ferramentas", async () => {
    const rows = await withTenant(tenantA, (tx) => tx.select().from(ferramentas));
    expect(rows).toHaveLength(1);
    expect(rows[0].marca).toBe("MarcaA");
    expect(rows.every((r) => r.tenantId === tenantA)).toBe(true);
  });

  it("tenant B só enxerga as próprias ferramentas", async () => {
    const rows = await withTenant(tenantB, (tx) => tx.select().from(ferramentas));
    expect(rows).toHaveLength(1);
    expect(rows[0].marca).toBe("MarcaB");
  });

  it("sem tenant definido, nada é retornado (fail-safe)", async () => {
    const rows = await db.select().from(ferramentas);
    expect(rows).toHaveLength(0);
  });

  it("WITH CHECK barra inserir ferramenta de outro tenant", async () => {
    await expect(
      withTenant(tenantA, (tx) =>
        tx.insert(ferramentas).values({ tenantId: tenantB, tipo: "pneumatica" }),
      ),
    ).rejects.toThrow();
  });

  it("insert válido no próprio tenant é permitido e aparece só para ele", async () => {
    await withTenant(tenantA, (tx) =>
      tx.insert(ferramentas).values({ tenantId: tenantA, tipo: "manual", marca: "InseridaA" }),
    );
    const rowsA = await withTenant(tenantA, (tx) => tx.select().from(ferramentas));
    const rowsB = await withTenant(tenantB, (tx) => tx.select().from(ferramentas));
    expect(rowsA.some((r) => r.marca === "InseridaA")).toBe(true);
    expect(rowsB.some((r) => r.marca === "InseridaA")).toBe(false);
  });
});
