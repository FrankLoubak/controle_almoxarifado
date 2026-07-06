/**
 * Finalidade: teste de integração dos relatórios (Sprint 8) — seção 7.
 * Como funciona: fixtures via dono (ferramentas em estados variados, empréstimo ativo,
 *   orçamento liberado); token via signAccessToken. Verifica catálogo, cada relatório
 *   principal, o filtro por período, autorização e isolamento entre tenants.
 * Relações: exercita rotas/relatorios, relatorioService e RLS.
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
const dia = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const ontem = dia(-1);
const amanha = dia(1);

let tenantA: string;
let tenantB: string;
let almoxA: string;
let depoA: string;
let token: string;
let tokenB: string;

async function q(text: string, params: unknown[] = []) {
  return (await owner.query(text, params)).rows[0];
}
async function insTenant() {
  return (await q(`INSERT INTO tenants (razao_social, cnpj, email, telefone) VALUES ($1,$2,'t@x','+550') RETURNING id`, [`T ${digits()}`, digits()])).id;
}
async function insFunc(t: string, almox = false) {
  return (await q(`INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife) VALUES ($1,'F',$2,$3) RETURNING id`, [t, `+55${digits().slice(0, 11)}`, almox])).id;
}
async function insFerr(t: string, status = "disponivel") {
  return (await q(`INSERT INTO ferramentas (tenant_id, tipo, marca, status) VALUES ($1,'furadeira','Bosch',$2) RETURNING id`, [t, status])).id;
}

beforeAll(async () => {
  tenantA = await insTenant();
  tenantB = await insTenant();
  almoxA = await insFunc(tenantA, true);
  depoA = await insFunc(tenantA, false);
  token = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isAlmoxarife: true });
  tokenB = signAccessToken({ sub: await insFunc(tenantB, true), type: "funcionario", tenantId: tenantB, isAlmoxarife: true });

  await insFerr(tenantA, "disponivel");
  const ferAlug = await insFerr(tenantA, "alugada");
  await owner.query(`INSERT INTO emprestimos (tenant_id, id_ferramenta, id_depositario, id_funcionario_emprestador) VALUES ($1,$2,$3,$4)`, [tenantA, ferAlug, depoA, almoxA]);
  const ferGasto = await insFerr(tenantA, "em_reparo");
  const prest = (await q(`INSERT INTO prestadores (tenant_id, nome) VALUES ($1,'P') RETURNING id`, [tenantA])).id;
  await owner.query(`INSERT INTO orcamentos (tenant_id, id_ferramenta, id_prestador, tipo_reparo, valor_orcamento, status) VALUES ($1,$2,$3,'externo',100.00,'liberado')`, [tenantA, ferGasto, prest]);
});

afterAll(async () => {
  const ids = [tenantA, tenantB];
  for (const t of ["orcamentos", "emprestimos", "prestadores", "ferramentas", "funcionarios"]) {
    await owner.query(`DELETE FROM ${t} WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  }
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [ids]);
  await owner.end();
  await pool.end();
});

const H = () => ({ Authorization: `Bearer ${token}` });

describe("Relatórios", () => {
  it("catálogo lista os 8 relatórios", async () => {
    const r = await request(app).get("/relatorios").set(H());
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(8);
  });

  it("disponíveis, alugadas (com dias) e gasto por ferramenta", async () => {
    const disp = await request(app).get("/relatorios/disponiveis").set(H());
    expect(disp.body.length).toBeGreaterThanOrEqual(1);

    const alug = await request(app).get("/relatorios/alugadas").set(H());
    expect(alug.body).toHaveLength(1);
    expect(alug.body[0].dias).toBeGreaterThanOrEqual(0);

    const gasto = await request(app).get("/relatorios/gasto-reparos").set(H());
    expect(gasto.body).toHaveLength(1);
    expect(Number(gasto.body[0].total)).toBe(100);
  });

  it("empréstimos abertos por funcionário e dias por ferramenta", async () => {
    const abertos = await request(app).get("/relatorios/emprestimos-abertos").set(H());
    expect(abertos.body).toHaveLength(1);
    expect(abertos.body[0].qtd).toBe(1);

    const dias = await request(app).get("/relatorios/dias").set(H());
    expect(dias.body.some((x: { dias_emprestimo: number }) => x.dias_emprestimo >= 0)).toBe(true);
  });

  it("filtro por período restringe os resultados", async () => {
    const vazio = await request(app).get("/relatorios/alugadas?inicio=2000-01-01&fim=2000-01-02").set(H());
    expect(vazio.body).toHaveLength(0);
    const cheio = await request(app).get(`/relatorios/alugadas?inicio=${ontem}&fim=${amanha}`).set(H());
    expect(cheio.body).toHaveLength(1);
  });

  it("relatório inexistente → 404; sem token → 401; não-almoxarife → 403", async () => {
    expect((await request(app).get("/relatorios/inexistente").set(H())).status).toBe(404);
    expect((await request(app).get("/relatorios/disponiveis")).status).toBe(401);
    const depo = signAccessToken({ sub: depoA, type: "funcionario", tenantId: tenantA, isAlmoxarife: false });
    expect((await request(app).get("/relatorios/disponiveis").set({ Authorization: `Bearer ${depo}` })).status).toBe(403);
  });

  it("isolamento: tenant B não vê dados de A", async () => {
    const r = await request(app).get("/relatorios/disponiveis").set({ Authorization: `Bearer ${tokenB}` });
    expect(r.body).toHaveLength(0);
  });
});
