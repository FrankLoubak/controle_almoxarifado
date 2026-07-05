/**
 * Finalidade: teste de integração do Sprint 4 (Ferramenta + máquina de estados).
 * Como funciona: fixtures via dono (tenant + almoxarife), token via signAccessToken;
 *   exercita CRUD e as ações de status (enviar/retornar reparo, sucatear), incluindo
 *   transições inválidas, cancelamento em cascata do sucateamento (D13) e isolamento.
 * Relações: exercita rotas/ferramentas, ferramentaService, toolStatusMachine e RLS.
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
let tenantB: string;
let almoxA: string;
let token: string;
let tokenB: string;

async function insTenant(): Promise<string> {
  const r = await owner.query(
    `INSERT INTO tenants (razao_social, cnpj, email, telefone) VALUES ($1,$2,'t@x.local','+550') RETURNING id`,
    [`T ${digits()}`, digits()],
  );
  return r.rows[0].id;
}
async function insFerramenta(tenant: string, status = "disponivel"): Promise<string> {
  const r = await owner.query(
    `INSERT INTO ferramentas (tenant_id, tipo, marca, status) VALUES ($1,'manual','MarcaX',$2) RETURNING id`,
    [tenant, status],
  );
  return r.rows[0].id;
}
async function statusOf(id: string): Promise<string> {
  const r = await owner.query(`SELECT status FROM ferramentas WHERE id=$1`, [id]);
  return r.rows[0].status;
}

beforeAll(async () => {
  tenantA = await insTenant();
  tenantB = await insTenant();
  const r = await owner.query(
    `INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife) VALUES ($1,'A',$2,true) RETURNING id`,
    [tenantA, `+55${digits().slice(0, 11)}`],
  );
  almoxA = r.rows[0].id;
  token = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isAlmoxarife: true });
  tokenB = signAccessToken({ sub: randomUUID(), type: "funcionario", tenantId: tenantB, isAlmoxarife: true });
});

afterAll(async () => {
  const ids = [tenantA, tenantB];
  for (const t of ["reparos_externos", "reparos_internos", "orcamentos", "emprestimos", "prestadores", "ferramentas"]) {
    await owner.query(`DELETE FROM ${t} WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  }
  await owner.query(`DELETE FROM funcionarios WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [ids]);
  await owner.end();
  await pool.end();
});

const H = () => ({ Authorization: `Bearer ${token}` });

describe("Ferramenta — CRUD e autorização", () => {
  it("sem token → 401; não-almoxarife → 403", async () => {
    expect((await request(app).get("/ferramentas")).status).toBe(401);
    const depo = signAccessToken({ sub: randomUUID(), type: "funcionario", tenantId: tenantA, isAlmoxarife: false });
    expect((await request(app).get("/ferramentas").set({ Authorization: `Bearer ${depo}` })).status).toBe(403);
  });

  it("cria (disponivel), busca e edita", async () => {
    const c = await request(app).post("/ferramentas").set(H()).send({ tipo: "eletrica", marca: "Bosch" });
    expect(c.status).toBe(201);
    expect(c.body.status).toBe("disponivel");
    const s = await request(app).get("/ferramentas?search=Bosch").set(H());
    expect(s.body.some((f: { id: string }) => f.id === c.body.id)).toBe(true);
    const u = await request(app).patch(`/ferramentas/${c.body.id}`).set(H()).send({ marca: "Makita" });
    expect(u.body.marca).toBe("Makita");
  });

  it("isolamento entre tenants (404)", async () => {
    const f = await insFerramenta(tenantA);
    expect((await request(app).get(`/ferramentas/${f}`).set({ Authorization: `Bearer ${tokenB}` })).status).toBe(404);
  });
});

describe("Ferramenta — máquina de estados", () => {
  it("enviar-reparo só de disponivel; repetir → 409", async () => {
    const f = await insFerramenta(tenantA, "disponivel");
    const ok = await request(app).post(`/ferramentas/${f}/enviar-reparo`).set(H());
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("aguardando_orcamento");
    const again = await request(app).post(`/ferramentas/${f}/enviar-reparo`).set(H());
    expect(again.status).toBe(409);
  });

  it("retornar-reparo só de aguardando_devolucao", async () => {
    const f = await insFerramenta(tenantA, "disponivel");
    expect((await request(app).post(`/ferramentas/${f}/retornar-reparo`).set(H())).status).toBe(409);

    const g = await insFerramenta(tenantA, "aguardando_devolucao");
    const ok = await request(app).post(`/ferramentas/${g}/retornar-reparo`).set(H());
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("disponivel");
  });

  it("sucatear de disponivel; alugada não pode; já sucateada → 409", async () => {
    const f = await insFerramenta(tenantA, "disponivel");
    const ok = await request(app).post(`/ferramentas/${f}/sucatear`).set(H());
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("sucateada");
    expect((await request(app).post(`/ferramentas/${f}/sucatear`).set(H())).status).toBe(409);

    const alugada = await insFerramenta(tenantA, "alugada");
    expect((await request(app).post(`/ferramentas/${alugada}/sucatear`).set(H())).status).toBe(409);
  });

  it("sucatear cancela reparo/orçamento em aberto (D13)", async () => {
    const f = await insFerramenta(tenantA, "em_reparo");
    const p = await owner.query(`INSERT INTO prestadores (tenant_id, nome) VALUES ($1,'P') RETURNING id`, [tenantA]);
    const orc = await owner.query(
      `INSERT INTO orcamentos (tenant_id, id_ferramenta, id_prestador, tipo_reparo, valor_orcamento, status)
       VALUES ($1,$2,$3,'externo',50,'liberado') RETURNING id`,
      [tenantA, f, p.rows[0].id],
    );
    const rep = await owner.query(
      `INSERT INTO reparos_externos (tenant_id, id_ferramenta, id_funcionario_requisitante, id_prestador, id_orcamento)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantA, f, almoxA, p.rows[0].id, orc.rows[0].id],
    );
    const ok = await request(app).post(`/ferramentas/${f}/sucatear`).set(H());
    expect(ok.status).toBe(200);

    const orcRow = await owner.query(`SELECT canceled_at FROM orcamentos WHERE id=$1`, [orc.rows[0].id]);
    const repRow = await owner.query(`SELECT canceled_at FROM reparos_externos WHERE id=$1`, [rep.rows[0].id]);
    expect(orcRow.rows[0].canceled_at).not.toBeNull();
    expect(repRow.rows[0].canceled_at).not.toBeNull();
  });

  it("exclusão: permitida em disponivel; bloqueada se alugada", async () => {
    const f = await insFerramenta(tenantA, "disponivel");
    expect((await request(app).delete(`/ferramentas/${f}`).set(H())).status).toBe(200);
    const alugada = await insFerramenta(tenantA, "alugada");
    expect((await request(app).delete(`/ferramentas/${alugada}`).set(H())).status).toBe(409);
    expect(await statusOf(alugada)).toBe("alugada");
  });
});
