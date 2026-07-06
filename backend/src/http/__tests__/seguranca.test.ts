/**
 * Finalidade: verificação de hardening (Sprint 10) — cabeçalhos, RLS forçado, role de app.
 * Como funciona: checa cabeçalhos do helmet numa resposta; confirma no catálogo do Postgres
 *   que todas as tabelas de tenant têm FORCE ROW LEVEL SECURITY e que a role almox_app não
 *   é superuser nem tem BYPASSRLS.
 * Relações: valida app.ts (securityHeaders) e as migrations de RLS (0001).
 */
import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { pool } from "../../db/client";
import { MIGRATION_URL } from "../../db/urls";

const { Pool } = pg;
const owner = new Pool({ connectionString: MIGRATION_URL });
const app = createApp();

const TENANT_TABLES = [
  "tenants",
  "assinaturas",
  "funcionarios",
  "prestadores",
  "ferramentas",
  "emprestimos",
  "orcamentos",
  "reparos_externos",
  "reparos_internos",
];

afterAll(async () => {
  await owner.end();
  await pool.end();
});

describe("Hardening", () => {
  it("aplica cabeçalhos de segurança (helmet)", async () => {
    const r = await request(app).get("/health");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-dns-prefetch-control"]).toBeDefined();
    expect(r.headers["x-powered-by"]).toBeUndefined();
  });

  it("FORCE ROW LEVEL SECURITY em todas as tabelas de tenant", async () => {
    const r = await owner.query(
      `SELECT relname, relforcerowsecurity FROM pg_class WHERE relname = ANY($1::text[])`,
      [TENANT_TABLES],
    );
    const map = new Map(r.rows.map((x) => [x.relname, x.relforcerowsecurity]));
    for (const t of TENANT_TABLES) expect(map.get(t)).toBe(true);
  });

  it("role de aplicação almox_app não é superuser nem tem BYPASSRLS", async () => {
    const r = await owner.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='almox_app'`);
    expect(r.rows[0].rolsuper).toBe(false);
    expect(r.rows[0].rolbypassrls).toBe(false);
  });
});
