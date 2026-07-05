/**
 * Finalidade: teste de integração da Assinatura (Sprint 9) — PaymentProvider mock.
 * Como funciona: fixtures via dono (tenant atrasado + Root + almoxarife); token via
 *   signAccessToken. Verifica consultar/criar/regularizar/cancelar (Root only), o webhook
 *   público, e que tenants.status_assinatura (usado no bloqueio de login) é atualizado.
 * Relações: exercita rotas/assinatura, assinaturaService, payments (mock) e a função
 *   SECURITY DEFINER do webhook.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signAccessToken } from "../../auth/tokens";
import { createApp } from "../../app";
import { pool } from "../../db/client";
import { MIGRATION_URL } from "../../db/urls";

const { Pool } = pg;
const owner = new Pool({ connectionString: MIGRATION_URL });
const app = createApp();
const digits = () => randomUUID().replace(/\D/g, "").padEnd(14, "0").slice(0, 14);

let tenantA: string;
let rootA: string;
let almoxA: string;
let rootToken: string;
let almoxToken: string;

async function tenantStatus(id: string): Promise<string> {
  return (await owner.query(`SELECT status_assinatura FROM tenants WHERE id=$1`, [id])).rows[0].status_assinatura;
}

beforeAll(async () => {
  tenantA = (await owner.query(
    `INSERT INTO tenants (razao_social, cnpj, email, telefone, status_assinatura) VALUES ($1,$2,'t@x','+550','atrasado') RETURNING id`,
    [`T ${digits()}`, digits()],
  )).rows[0].id;
  rootA = (await owner.query(`INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife, is_root) VALUES ($1,'Root',$2,true,true) RETURNING id`, [tenantA, `+55${digits().slice(0, 11)}`])).rows[0].id;
  almoxA = (await owner.query(`INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife) VALUES ($1,'A',$2,true) RETURNING id`, [tenantA, `+55${digits().slice(0, 11)}`])).rows[0].id;
  rootToken = signAccessToken({ sub: rootA, type: "funcionario", tenantId: tenantA, isRoot: true, isAlmoxarife: true });
  almoxToken = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isRoot: false, isAlmoxarife: true });
});

afterAll(async () => {
  await owner.query(`DELETE FROM assinaturas WHERE tenant_id=$1`, [tenantA]);
  await owner.query(`DELETE FROM funcionarios WHERE tenant_id=$1`, [tenantA]);
  await owner.query(`DELETE FROM tenants WHERE id=$1`, [tenantA]);
  await owner.end();
  await pool.end();
});

const R = () => ({ Authorization: `Bearer ${rootToken}` });

describe("Assinatura", () => {
  it("gestão é exclusiva do Root (almoxarife → 403; sem token → 401)", async () => {
    expect((await request(app).get("/assinatura")).status).toBe(401);
    expect((await request(app).get("/assinatura").set({ Authorization: `Bearer ${almoxToken}` })).status).toBe(403);
  });

  it("consulta inicial: sem assinatura, tenant atrasado", async () => {
    const r = await request(app).get("/assinatura").set(R());
    expect(r.status).toBe(200);
    expect(r.body.assinatura).toBeNull();
    expect(r.body.tenantStatus).toBe("atrasado");
  });

  it("criar assinatura deixa o tenant regular (desbloqueia login)", async () => {
    const c = await request(app).post("/assinatura").set(R()).send({ plano: "mensal" });
    expect(c.status).toBe(201);
    expect(c.body.status).toBe("regular");
    expect(c.body.providerUsado).toBe("mock");
    expect(await tenantStatus(tenantA)).toBe("regular");
  });

  it("webhook (público) atualiza o status; corpo inválido → 400", async () => {
    const inval = await request(app).post("/pagamentos/webhook").send({ foo: "bar" });
    expect(inval.status).toBe(400);

    const atrasa = await request(app).post("/pagamentos/webhook").send({ tenantId: tenantA, status: "atrasado" });
    expect(atrasa.status).toBe(200);
    expect(await tenantStatus(tenantA)).toBe("atrasado");
  });

  it("regularizar volta o tenant para regular", async () => {
    const r = await request(app).post("/assinatura/regularizar").set(R());
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("regular");
    expect(await tenantStatus(tenantA)).toBe("regular");
  });

  it("cancelar deixa o tenant cancelado", async () => {
    const r = await request(app).post("/assinatura/cancelar").set(R());
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("cancelado");
    expect(await tenantStatus(tenantA)).toBe("cancelado");
  });
});
