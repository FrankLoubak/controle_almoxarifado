/**
 * Finalidade: teste de integração do Sprint 3 (Funcionário + Prestador).
 * Como funciona: cria fixtures via conexão do dono (2 tenants, Root e almoxarife), emite
 *   access tokens direto (signAccessToken) e exercita as rotas via supertest — CRUD,
 *   promoção (Root only), soft-delete com bloqueios (D9), unicidade de telefone,
 *   autorização e isolamento entre tenants.
 * Relações: exercita rotas/funcionarios e /prestadores, services e RLS. Requer Postgres.
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
let rootA: string;
let almoxA: string;
let rootToken: string;
let almoxToken: string;
let rootTokenB: string;

async function insTenant(): Promise<string> {
  const r = await owner.query(
    `INSERT INTO tenants (razao_social, cnpj, email, telefone, status_assinatura)
     VALUES ($1,$2,'t@x.local','+550','regular') RETURNING id`,
    [`T ${digits()}`, digits()],
  );
  return r.rows[0].id;
}
async function insFunc(tenant: string, opts: { root?: boolean; almox?: boolean } = {}): Promise<string> {
  const r = await owner.query(
    `INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife, is_root)
     VALUES ($1,'F',$2,$3,$4) RETURNING id`,
    [tenant, `+55${digits().slice(0, 11)}`, opts.almox ?? false, opts.root ?? false],
  );
  return r.rows[0].id;
}

beforeAll(async () => {
  tenantA = await insTenant();
  tenantB = await insTenant();
  rootA = await insFunc(tenantA, { root: true, almox: true });
  almoxA = await insFunc(tenantA, { almox: true });
  const rootB = await insFunc(tenantB, { root: true, almox: true });
  await owner.query(`UPDATE tenants SET id_root_funcionario=$1 WHERE id=$2`, [rootA, tenantA]);
  await owner.query(`UPDATE tenants SET id_root_funcionario=$1 WHERE id=$2`, [rootB, tenantB]);

  rootToken = signAccessToken({ sub: rootA, type: "funcionario", tenantId: tenantA, isRoot: true, isAlmoxarife: true });
  almoxToken = signAccessToken({ sub: almoxA, type: "funcionario", tenantId: tenantA, isRoot: false, isAlmoxarife: true });
  rootTokenB = signAccessToken({ sub: rootB, type: "funcionario", tenantId: tenantB, isRoot: true, isAlmoxarife: true });
});

afterAll(async () => {
  const ids = [tenantA, tenantB];
  for (const table of [
    "reparos_externos",
    "reparos_internos",
    "orcamentos",
    "emprestimos",
    "otp_challenges",
    "prestadores",
    "ferramentas",
  ]) {
    await owner.query(`DELETE FROM ${table} WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  }
  await owner.query(`UPDATE tenants SET id_root_funcionario=NULL WHERE id = ANY($1::uuid[])`, [ids]);
  await owner.query(`DELETE FROM funcionarios WHERE tenant_id = ANY($1::uuid[])`, [ids]);
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [ids]);
  await owner.end();
  await pool.end();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("Funcionário — CRUD e autorização", () => {
  it("sem token → 401; token não-almoxarife → 403", async () => {
    expect((await request(app).get("/funcionarios")).status).toBe(401);
    const depoToken = signAccessToken({ sub: randomUUID(), type: "funcionario", tenantId: tenantA, isRoot: false, isAlmoxarife: false });
    expect((await request(app).get("/funcionarios").set(auth(depoToken))).status).toBe(403);
  });

  it("almoxarife cria funcionário (depositário) e busca por nome", async () => {
    const create = await request(app)
      .post("/funcionarios")
      .set(auth(almoxToken))
      .send({ nome: "João Depositário", numeroTelefone: `+55${digits().slice(0, 11)}` });
    expect(create.status).toBe(201);
    expect(create.body.statusAlmoxarife).toBe(false);

    const search = await request(app).get("/funcionarios?search=João").set(auth(almoxToken));
    expect(search.status).toBe(200);
    expect(search.body.some((f: { id: string }) => f.id === create.body.id)).toBe(true);
  });

  it("telefone duplicado → 409", async () => {
    const tel = `+55${digits().slice(0, 11)}`;
    await request(app).post("/funcionarios").set(auth(rootToken)).send({ nome: "A", numeroTelefone: tel });
    const dup = await request(app).post("/funcionarios").set(auth(rootToken)).send({ nome: "B", numeroTelefone: tel });
    expect(dup.status).toBe(409);
  });

  it("promoção a almoxarife é exclusiva do Root", async () => {
    const f = await request(app)
      .post("/funcionarios")
      .set(auth(rootToken))
      .send({ nome: "Promovível", numeroTelefone: `+55${digits().slice(0, 11)}` });

    const byAlmox = await request(app).post(`/funcionarios/${f.body.id}/promover`).set(auth(almoxToken)).send({ senha: "Nova@123" });
    expect(byAlmox.status).toBe(403);

    const byRoot = await request(app).post(`/funcionarios/${f.body.id}/promover`).set(auth(rootToken)).send({ senha: "Nova@123" });
    expect(byRoot.status).toBe(200);
    expect(byRoot.body.statusAlmoxarife).toBe(true);
  });

  it("edita e faz soft-delete (some do GET/list)", async () => {
    const f = await request(app)
      .post("/funcionarios")
      .set(auth(rootToken))
      .send({ nome: "Editável", numeroTelefone: `+55${digits().slice(0, 11)}` });
    const upd = await request(app).patch(`/funcionarios/${f.body.id}`).set(auth(rootToken)).send({ nome: "Editado" });
    expect(upd.body.nome).toBe("Editado");

    const del = await request(app).delete(`/funcionarios/${f.body.id}`).set(auth(rootToken));
    expect(del.status).toBe(200);
    expect((await request(app).get(`/funcionarios/${f.body.id}`).set(auth(rootToken))).status).toBe(404);
  });

  it("não exclui o Root da empresa (409)", async () => {
    const del = await request(app).delete(`/funcionarios/${rootA}`).set(auth(rootToken));
    expect(del.status).toBe(409);
  });

  it("não exclui funcionário com empréstimo ativo (409)", async () => {
    const depo = await insFunc(tenantA);
    const fr = await owner.query(
      `INSERT INTO ferramentas (tenant_id, tipo) VALUES ($1,'manual') RETURNING id`,
      [tenantA],
    );
    await owner.query(
      `INSERT INTO emprestimos (tenant_id, id_ferramenta, id_depositario, id_funcionario_emprestador)
       VALUES ($1,$2,$3,$4)`,
      [tenantA, fr.rows[0].id, depo, almoxA],
    );
    const del = await request(app).delete(`/funcionarios/${depo}`).set(auth(rootToken));
    expect(del.status).toBe(409);
  });

  it("isolamento: token do tenant B não enxerga funcionário do tenant A", async () => {
    const got = await request(app).get(`/funcionarios/${rootA}`).set(auth(rootTokenB));
    expect(got.status).toBe(404);
  });
});

describe("Prestador — CRUD e vínculo", () => {
  it("cria prestador interno (idFuncionario) e rejeita id inválido", async () => {
    const ok = await request(app)
      .post("/prestadores")
      .set(auth(rootToken))
      .send({ nome: "Oficina Interna", idFuncionario: almoxA });
    expect(ok.status).toBe(201);
    expect(ok.body.idFuncionario).toBe(almoxA);

    const bad = await request(app)
      .post("/prestadores")
      .set(auth(rootToken))
      .send({ nome: "X", idFuncionario: randomUUID() });
    expect(bad.status).toBe(400);
  });

  it("soft-delete de prestador e bloqueio por reparo externo em aberto", async () => {
    const prest = await request(app).post("/prestadores").set(auth(rootToken)).send({ nome: "Externa" });
    const del = await request(app).delete(`/prestadores/${prest.body.id}`).set(auth(rootToken));
    expect(del.status).toBe(200);

    // Prestador com reparo externo em aberto não pode ser excluído.
    const p2 = await request(app).post("/prestadores").set(auth(rootToken)).send({ nome: "Externa2" });
    const fr = await owner.query(`INSERT INTO ferramentas (tenant_id, tipo) VALUES ($1,'manual') RETURNING id`, [tenantA]);
    const orc = await owner.query(
      `INSERT INTO orcamentos (tenant_id, id_ferramenta, id_prestador, tipo_reparo, valor_orcamento, status)
       VALUES ($1,$2,$3,'externo',100.00,'liberado') RETURNING id`,
      [tenantA, fr.rows[0].id, p2.body.id],
    );
    await owner.query(
      `INSERT INTO reparos_externos (tenant_id, id_ferramenta, id_funcionario_requisitante, id_prestador, id_orcamento)
       VALUES ($1,$2,$3,$4,$5)`,
      [tenantA, fr.rows[0].id, almoxA, p2.body.id, orc.rows[0].id],
    );
    const blocked = await request(app).delete(`/prestadores/${p2.body.id}`).set(auth(rootToken));
    expect(blocked.status).toBe(409);
  });
});
