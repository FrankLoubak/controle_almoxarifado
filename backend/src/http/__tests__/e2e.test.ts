/**
 * Finalidade: teste E2E completo (Sprint 10) — exercita o sistema ponta a ponta via HTTP.
 * Como funciona: login real (telefone+senha+OTP do adapter mock) e então percorre o ciclo
 *   de vida: cadastro, empréstimo (realizar/encerrar), reparo (enviar→orçamento→liberar→
 *   concluir→retornar), relatório e assinatura — tudo pela API, com o mesmo token.
 * Relações: integra auth, funcionários, prestadores, ferramentas, empréstimos, orçamentos,
 *   reparos, relatórios e assinatura. Requer Postgres + migrations.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../auth/password";
import { createApp } from "../../app";
import { pool } from "../../db/client";
import { MIGRATION_URL } from "../../db/urls";
import { lastMessageTo } from "../../notifications/logProvider";

const { Pool } = pg;
const owner = new Pool({ connectionString: MIGRATION_URL });
const app = createApp();
const digits = () => randomUUID().replace(/\D/g, "").padEnd(14, "0").slice(0, 14);

let tenant: string;
let rootId: string;
const telefone = `+55119${digits().slice(0, 8)}`;
const SENHA = "Senha@123";
let token = "";
const H = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  tenant = (await owner.query(`INSERT INTO tenants (razao_social, cnpj, email, telefone) VALUES ($1,$2,'t@x','+550') RETURNING id`, [`T ${digits()}`, digits()])).rows[0].id;
  rootId = (await owner.query(
    `INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife, is_root, senha_hash) VALUES ($1,'Root',$2,true,true,$3) RETURNING id`,
    [tenant, telefone, await hashPassword(SENHA)],
  )).rows[0].id;
  await owner.query(`UPDATE tenants SET id_root_funcionario=$1 WHERE id=$2`, [rootId, tenant]);
});

afterAll(async () => {
  for (const t of ["reparos_externos", "reparos_internos", "orcamentos", "emprestimos", "assinaturas", "prestadores", "ferramentas", "otp_challenges"]) {
    await owner.query(`DELETE FROM ${t} WHERE tenant_id=$1`, [tenant]);
  }
  await owner.query(`DELETE FROM refresh_tokens WHERE subject_id=$1`, [rootId]);
  await owner.query(`UPDATE tenants SET id_root_funcionario=NULL WHERE id=$1`, [tenant]);
  await owner.query(`DELETE FROM funcionarios WHERE tenant_id=$1`, [tenant]);
  await owner.query(`DELETE FROM tenants WHERE id=$1`, [tenant]);
  await owner.end();
  await pool.end();
});

describe("E2E — ciclo de vida completo", () => {
  it("login (2FA) → cadastro → empréstimo → reparo → relatório → assinatura", async () => {
    // Login real com OTP (adapter mock).
    const login = await request(app).post("/auth/login").send({ telefone, senha: SENHA });
    expect(login.status).toBe(200);
    const codigo = (lastMessageTo(telefone) ?? "").match(/(\d{6})/)![1];
    const verify = await request(app).post("/auth/verify-otp").send({ challengeId: login.body.challengeId, codigo });
    expect(verify.status).toBe(200);
    token = verify.body.accessToken;

    // Cadastro de depositário, ferramenta e prestador externo.
    const depo = await request(app).post("/funcionarios").set(H()).send({ nome: "Depo", numeroTelefone: `+55${digits().slice(0, 11)}` });
    const fer = await request(app).post("/ferramentas").set(H()).send({ tipo: "furadeira", marca: "Bosch" });
    const prest = await request(app).post("/prestadores").set(H()).send({ nome: "Oficina" });
    expect([depo.status, fer.status, prest.status]).toEqual([201, 201, 201]);

    // Empréstimo: realizar e encerrar.
    const emp = await request(app).post("/emprestimos").set(H()).send({ idFerramenta: fer.body.id, idDepositario: depo.body.id });
    expect(emp.status).toBe(201);
    expect((await request(app).get(`/ferramentas/${fer.body.id}`).set(H())).body.status).toBe("alugada");
    await request(app).post(`/emprestimos/${emp.body.id}/encerrar`).set(H());
    expect((await request(app).get(`/ferramentas/${fer.body.id}`).set(H())).body.status).toBe("disponivel");

    // Reparo externo completo.
    await request(app).post(`/ferramentas/${fer.body.id}/enviar-reparo`).set(H());
    const orc = await request(app).post("/orcamentos").set(H()).send({ idFerramenta: fer.body.id, idPrestador: prest.body.id, valorOrcamento: 120 });
    expect(orc.body.tipoReparo).toBe("externo");
    await request(app).post(`/orcamentos/${orc.body.id}/liberar`).set(H());
    expect((await request(app).get(`/ferramentas/${fer.body.id}`).set(H())).body.status).toBe("em_reparo");
    await request(app).post("/reparos/concluir").set(H()).send({ idFerramenta: fer.body.id, descricaoReparoRealizado: "ok" });
    await request(app).post(`/ferramentas/${fer.body.id}/retornar-reparo`).set(H());
    expect((await request(app).get(`/ferramentas/${fer.body.id}`).set(H())).body.status).toBe("disponivel");

    // Relatório: a ferramenta aparece como disponível.
    const rel = await request(app).get("/relatorios/disponiveis").set(H());
    expect(rel.body.some((x: { id: string }) => x.id === fer.body.id)).toBe(true);

    // Gasto em reparos reflete o orçamento liberado.
    const gasto = await request(app).get("/relatorios/gasto-reparos").set(H());
    expect(gasto.body.some((x: { id: string; total: string }) => x.id === fer.body.id && Number(x.total) === 120)).toBe(true);

    // Assinatura (Root): criar deixa o tenant regular.
    const ass = await request(app).post("/assinatura").set(H()).send({ plano: "anual" });
    expect(ass.status).toBe(201);
    expect((await request(app).get("/assinatura").set(H())).body.tenantStatus).toBe("regular");
  });
});
