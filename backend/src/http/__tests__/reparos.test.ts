/**
 * Finalidade: teste de integração do Sprint 6 (Reparo: orçamento + reparos + roteamento).
 * Como funciona: fixtures via dono (tenant, almoxarife, prestador externo e interno);
 *   exercita o fluxo completo de status (enviar→orçamento→liberar/recusar→concluir→
 *   retornar), o roteamento interno/externo (regra 13), o reparo interno sem orçamento
 *   (regra 11), e as guardas de estado. Token via signAccessToken.
 * Relações: exercita rotas/orcamentos e /reparos, os services e a máquina de estados.
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
let prestExterno: string;
let prestInterno: string;
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
async function insPrestador(tenant: string, idFuncionario: string | null): Promise<string> {
  const r = await owner.query(
    `INSERT INTO prestadores (tenant_id, nome, id_funcionario) VALUES ($1,'P',$2) RETURNING id`,
    [tenant, idFuncionario],
  );
  return r.rows[0].id;
}
async function insFerramenta(tenant: string): Promise<string> {
  const r = await owner.query(`INSERT INTO ferramentas (tenant_id, tipo) VALUES ($1,'manual') RETURNING id`, [tenant]);
  return r.rows[0].id;
}
async function statusOf(id: string): Promise<string> {
  const r = await owner.query(`SELECT status FROM ferramentas WHERE id=$1`, [id]);
  return r.rows[0].status;
}

const H = () => ({ Authorization: `Bearer ${token}` });
// Coloca a ferramenta em aguardando_orcamento (via ação do Sprint 4).
async function enviarReparo(id: string) {
  return request(app).post(`/ferramentas/${id}/enviar-reparo`).set(H());
}

beforeAll(async () => {
  tenantA = await insTenant();
  almoxA = await insFunc(tenantA, true);
  const respInterno = await insFunc(tenantA, false);
  prestExterno = await insPrestador(tenantA, null);
  prestInterno = await insPrestador(tenantA, respInterno);
  token = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isAlmoxarife: true });
  tenantB = await insTenant();
  tokenB = signAccessToken({ sub: randomUUID(), type: "funcionario", tenantId: tenantB, isAlmoxarife: true });
});

afterAll(async () => {
  const ids = [tenantA, tenantB];
  for (const t of ["reparos_externos", "reparos_internos", "orcamentos", "emprestimos", "prestadores", "ferramentas", "funcionarios"]) {
    await owner.query(`DELETE FROM ${t} WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  }
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [ids]);
  await owner.end();
  await pool.end();
});

describe("Reparo externo — fluxo completo", () => {
  it("enviar → orçamento → editar → liberar → concluir → retornar", async () => {
    const fer = await insFerramenta(tenantA);
    expect((await enviarReparo(fer)).body.status).toBe("aguardando_orcamento");

    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestExterno, valorOrcamento: 150.5 });
    expect(orc.status).toBe(201);
    expect(orc.body.tipoReparo).toBe("externo");
    expect(await statusOf(fer)).toBe("aguardando_liberacao");

    const edit = await request(app).patch(`/orcamentos/${orc.body.id}`).set(H()).send({ valorOrcamento: 200 });
    expect(edit.body.valorOrcamento).toBe("200.00");

    const lib = await request(app).post(`/orcamentos/${orc.body.id}/liberar`).set(H());
    expect(lib.status).toBe(200);
    expect(lib.body.tipo).toBe("externo");
    expect(await statusOf(fer)).toBe("em_reparo");

    const rep = await request(app).get(`/reparos?ferramenta=${fer}`).set(H());
    expect(rep.body).toHaveLength(1);
    expect(rep.body[0].tipo).toBe("externo");

    const concl = await request(app).post("/reparos/concluir").set(H()).send({ idFerramenta: fer, descricaoReparoRealizado: "trocado motor" });
    expect(concl.status).toBe(200);
    expect(await statusOf(fer)).toBe("aguardando_devolucao");

    const ret = await request(app).post(`/ferramentas/${fer}/retornar-reparo`).set(H());
    expect(ret.body.status).toBe("disponivel");
  });
});

describe("Orçamento — recusa (regras 12/20)", () => {
  it("recusar mantém o orçamento e devolve p/ aguardando_orcamento; novo orçamento é aceito", async () => {
    const fer = await insFerramenta(tenantA);
    await enviarReparo(fer);
    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestExterno, valorOrcamento: 90 });

    const rec = await request(app).post(`/orcamentos/${orc.body.id}/recusar`).set(H());
    expect(rec.status).toBe(200);
    expect(rec.body.status).toBe("recusado");
    expect(await statusOf(fer)).toBe("aguardando_orcamento");

    // O recusado permanece na base (regra 12).
    const list = await request(app).get(`/orcamentos?ferramenta=${fer}`).set(H());
    expect(list.body.some((o: { id: string; status: string }) => o.id === orc.body.id && o.status === "recusado")).toBe(true);

    // Novo orçamento é aceito (regra 20).
    const orc2 = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestExterno, valorOrcamento: 120 });
    expect(orc2.status).toBe(201);
  });
});

describe("Reparo interno — roteamento e sem orçamento", () => {
  it("orçamento com prestador interno gera reparo interno (regra 13)", async () => {
    const fer = await insFerramenta(tenantA);
    await enviarReparo(fer);
    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestInterno, valorOrcamento: 80 });
    expect(orc.body.tipoReparo).toBe("interno");
    const lib = await request(app).post(`/orcamentos/${orc.body.id}/liberar`).set(H());
    expect(lib.body.tipo).toBe("interno");
    expect(lib.body.reparo.idFuncionarioResponsavel).toBeTruthy();
    expect(lib.body.reparo.idOrcamento).toBe(orc.body.id);
  });

  it("reparo interno direto sem orçamento (regra 11); externo direto → 400", async () => {
    const fer = await insFerramenta(tenantA);
    await enviarReparo(fer);
    const direto = await request(app).post("/reparos/interno-direto").set(H()).send({ idFerramenta: fer, idPrestador: prestInterno });
    expect(direto.status).toBe(201);
    expect(direto.body.reparo.idOrcamento).toBeNull();
    expect(await statusOf(fer)).toBe("em_reparo");

    const fer2 = await insFerramenta(tenantA);
    await enviarReparo(fer2);
    const ext = await request(app).post("/reparos/interno-direto").set(H()).send({ idFerramenta: fer2, idPrestador: prestExterno });
    expect(ext.status).toBe(400);
  });
});

describe("Reparo — guardas, autorização e isolamento", () => {
  it("cadastrar orçamento exige ferramenta aguardando_orcamento (409)", async () => {
    const fer = await insFerramenta(tenantA); // disponivel
    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestExterno, valorOrcamento: 50 });
    expect(orc.status).toBe(409);
  });

  it("liberar/editar exigem orçamento pendente (409)", async () => {
    const fer = await insFerramenta(tenantA);
    await enviarReparo(fer);
    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestExterno, valorOrcamento: 70 });
    await request(app).post(`/orcamentos/${orc.body.id}/liberar`).set(H());
    // Já liberado: não pode liberar de novo nem editar.
    expect((await request(app).post(`/orcamentos/${orc.body.id}/liberar`).set(H())).status).toBe(409);
    expect((await request(app).patch(`/orcamentos/${orc.body.id}`).set(H()).send({ valorOrcamento: 1 })).status).toBe(409);
  });

  it("sem token → 401; não-almoxarife → 403; isolamento entre tenants → 404", async () => {
    expect((await request(app).get("/orcamentos")).status).toBe(401);
    const depo = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isAlmoxarife: false });
    expect((await request(app).get("/orcamentos").set({ Authorization: `Bearer ${depo}` })).status).toBe(403);

    const fer = await insFerramenta(tenantA);
    await enviarReparo(fer);
    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer, idPrestador: prestExterno, valorOrcamento: 10 });
    expect((await request(app).get(`/orcamentos/${orc.body.id}`).set({ Authorization: `Bearer ${tokenB}` })).status).toBe(404);
  });
});
