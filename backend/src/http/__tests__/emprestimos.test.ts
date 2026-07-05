/**
 * Finalidade: teste de integração do Sprint 5 (fluxo de Empréstimo) — fluxo crítico.
 * Como funciona: fixtures via dono (tenant, almoxarife, depositário, ferramentas), token
 *   via signAccessToken; exercita realizar/encerrar e as regras 1/2/4/8/14/16, o efeito
 *   na máquina de estados da ferramenta e o isolamento entre tenants.
 * Relações: exercita rotas/emprestimos, emprestimoService, ferramentas e RLS.
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
let depoA: string;
let token: string;
let tokenB: string;

async function insTenant(): Promise<string> {
  const r = await owner.query(
    `INSERT INTO tenants (razao_social, cnpj, email, telefone) VALUES ($1,$2,'t@x.local','+550') RETURNING id`,
    [`T ${digits()}`, digits()],
  );
  return r.rows[0].id;
}
async function insFunc(tenant: string, almox = false): Promise<string> {
  const r = await owner.query(
    `INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife) VALUES ($1,'F',$2,$3) RETURNING id`,
    [tenant, `+55${digits().slice(0, 11)}`, almox],
  );
  return r.rows[0].id;
}
async function insFerramenta(tenant: string): Promise<string> {
  const r = await owner.query(`INSERT INTO ferramentas (tenant_id, tipo) VALUES ($1,'manual') RETURNING id`, [tenant]);
  return r.rows[0].id;
}

beforeAll(async () => {
  tenantA = await insTenant();
  tenantB = await insTenant();
  almoxA = await insFunc(tenantA, true);
  depoA = await insFunc(tenantA, false);
  token = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isAlmoxarife: true });
  tokenB = signAccessToken({ sub: await insFunc(tenantB, true), type: "funcionario", tenantId: tenantB, isAlmoxarife: true });
});

afterAll(async () => {
  const ids = [tenantA, tenantB];
  for (const t of ["emprestimos", "ferramentas", "funcionarios"]) {
    await owner.query(`DELETE FROM ${t} WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  }
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [ids]);
  await owner.end();
  await pool.end();
});

const H = () => ({ Authorization: `Bearer ${token}` });

describe("Empréstimo — realizar", () => {
  it("realiza e move a ferramenta para alugada", async () => {
    const fer = await insFerramenta(tenantA);
    const r = await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer, idDepositario: depoA });
    expect(r.status).toBe(201);
    expect(r.body.idFuncionarioEmprestador).toBe(almoxA);
    const f = await request(app).get(`/ferramentas/${fer}`).set(H());
    expect(f.body.status).toBe("alugada");
  });

  it("ferramenta já alugada → 409 (regra 8); depositário inválido → 400; ferramenta inexistente → 404", async () => {
    const fer = await insFerramenta(tenantA);
    await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer, idDepositario: depoA });
    const again = await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer, idDepositario: depoA });
    expect(again.status).toBe(409);

    const badDep = await request(app)
      .post("/emprestimos")
      .set(H())
      .send({ idFerramenta: await insFerramenta(tenantA), idDepositario: randomUUID() });
    expect(badDep.status).toBe(400);

    const badFer = await request(app).post("/emprestimos").set(H()).send({ idFerramenta: randomUUID(), idDepositario: depoA });
    expect(badFer.status).toBe(404);
  });

  it("depositário pode ter vários empréstimos simultâneos (regra 4)", async () => {
    const f1 = await insFerramenta(tenantA);
    const f2 = await insFerramenta(tenantA);
    expect((await request(app).post("/emprestimos").set(H()).send({ idFerramenta: f1, idDepositario: depoA })).status).toBe(201);
    expect((await request(app).post("/emprestimos").set(H()).send({ idFerramenta: f2, idDepositario: depoA })).status).toBe(201);
  });
});

describe("Empréstimo — encerrar", () => {
  it("encerra empréstimo ativo e devolve a ferramenta (regras 14/16)", async () => {
    const fer = await insFerramenta(tenantA);
    const loan = await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer, idDepositario: depoA });

    const end = await request(app).post(`/emprestimos/${loan.body.id}/encerrar`).set(H());
    expect(end.status).toBe(200);
    expect(end.body.dataRetorno).toBeTruthy();
    expect((await request(app).get(`/ferramentas/${fer}`).set(H())).body.status).toBe("disponivel");

    // Reencerrar → 409 (regra 14).
    expect((await request(app).post(`/emprestimos/${loan.body.id}/encerrar`).set(H())).status).toBe(409);
    // Ferramenta liberada pode ser reemprestada.
    expect((await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer, idDepositario: depoA })).status).toBe(201);
  });

  it("encerrar inexistente → 404", async () => {
    expect((await request(app).post(`/emprestimos/${randomUUID()}/encerrar`).set(H())).status).toBe(404);
  });
});

describe("Empréstimo — autorização, listagem e isolamento", () => {
  it("sem token → 401; não-almoxarife → 403", async () => {
    expect((await request(app).get("/emprestimos")).status).toBe(401);
    const depoToken = signAccessToken({ sub: depoA, type: "funcionario", tenantId: tenantA, isAlmoxarife: false });
    expect((await request(app).get("/emprestimos").set({ Authorization: `Bearer ${depoToken}` })).status).toBe(403);
  });

  it("lista apenas ativos com ?ativo=true", async () => {
    const list = await request(app).get("/emprestimos?ativo=true").set(H());
    expect(list.status).toBe(200);
    expect(list.body.every((e: { dataRetorno: string | null }) => e.dataRetorno === null)).toBe(true);
  });

  it("isolamento: tenant B não enxerga empréstimo de A (404)", async () => {
    const fer = await insFerramenta(tenantA);
    const loan = await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer, idDepositario: depoA });
    expect((await request(app).get(`/emprestimos/${loan.body.id}`).set({ Authorization: `Bearer ${tokenB}` })).status).toBe(404);
  });
});
