/**
 * Finalidade: teste de integração do painel super-admin (Sprint 12).
 * Como funciona: token de super-admin via signAccessToken; exercita onboarding (empresa +
 *   Root), listagem, ativar/desativar (incl. bloqueio de login por !ativo), unicidade e
 *   autorização. O Root criado no onboarding é usado para provar o bloqueio.
 * Relações: exercita rotas/admin, adminService (funções SECURITY DEFINER) e o login.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signAccessToken } from "../../auth/tokens";
import { createApp } from "../../app";
import { pool } from "../../db/client";
import { MIGRATION_URL } from "../../db/urls";
import { lastMessageTo } from "../../notifications/logProvider";

const { Pool } = pg;
const owner = new Pool({ connectionString: MIGRATION_URL });
const app = createApp();
const digits = () => randomUUID().replace(/\D/g, "").padEnd(14, "0").slice(0, 14);

const adminToken = signAccessToken({ sub: randomUUID(), type: "super_admin" });
const funcToken = signAccessToken({ sub: randomUUID(), type: "funcionario", tenantId: randomUUID(), isAlmoxarife: true });
const A = { Authorization: `Bearer ${adminToken}` };

const tenantIds: string[] = [];
const rootIds: string[] = [];
const rootTel = `+55119${digits().slice(0, 8)}`;
const ROOT_SENHA = "Root@123";

afterAll(async () => {
  await owner.query(`DELETE FROM otp_challenges WHERE tenant_id = ANY($1::uuid[])`, [tenantIds]);
  await owner.query(`DELETE FROM refresh_tokens WHERE subject_id = ANY($1::uuid[])`, [rootIds]);
  await owner.query(`UPDATE tenants SET id_root_funcionario=NULL WHERE id = ANY($1::uuid[])`, [tenantIds]);
  await owner.query(`DELETE FROM funcionarios WHERE tenant_id = ANY($1::uuid[])`, [tenantIds]);
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [tenantIds]);
  await owner.end();
  await pool.end();
});

async function onboard(over: Partial<{ cnpj: string; rootTel: string }> = {}) {
  const r = await request(app).post("/admin/tenants").set(A).send({
    razaoSocial: "Empresa Nova",
    cnpj: over.cnpj ?? digits(),
    email: "contato@nova.local",
    telefone: "+5511000000000",
    root: { nome: "Root Novo", telefone: over.rootTel ?? `+55${digits().slice(0, 11)}`, senha: ROOT_SENHA },
  });
  if (r.status === 201) {
    tenantIds.push(r.body.tenant_id);
    rootIds.push(r.body.root_id);
  }
  return r;
}

beforeAll(() => {});

describe("Super-admin", () => {
  it("autorização: sem token → 401; funcionário → 403", async () => {
    expect((await request(app).get("/admin/tenants")).status).toBe(401);
    expect((await request(app).get("/admin/tenants").set({ Authorization: `Bearer ${funcToken}` })).status).toBe(403);
  });

  it("onboarding cria empresa + Root (ativo, com Root amarrado)", async () => {
    const r = await onboard({ rootTel });
    expect(r.status).toBe(201);
    expect(r.body.tenant_id).toBeTruthy();
    expect(r.body.root_id).toBeTruthy();
    const t = (await owner.query(`SELECT ativo, id_root_funcionario FROM tenants WHERE id=$1`, [r.body.tenant_id])).rows[0];
    expect(t.ativo).toBe(true);
    expect(t.id_root_funcionario).toBe(r.body.root_id);
    const f = (await owner.query(`SELECT is_root, status_almoxarife, senha_hash FROM funcionarios WHERE id=$1`, [r.body.root_id])).rows[0];
    expect(f.is_root).toBe(true);
    expect(f.status_almoxarife).toBe(true);
    expect(f.senha_hash).toBeTruthy();
  });

  it("lista as empresas (inclui a recém-criada)", async () => {
    const r = await request(app).get("/admin/tenants").set(A);
    expect(r.status).toBe(200);
    expect(r.body.some((x: { id: string }) => x.id === tenantIds[0])).toBe(true);
  });

  it("CNPJ duplicado → 409", async () => {
    const cnpj = digits();
    await onboard({ cnpj });
    const dup = await onboard({ cnpj });
    expect(dup.status).toBe(409);
  });

  it("desativar bloqueia o login do Root; reativar libera", async () => {
    // O Root criado no 1º onboarding loga normalmente (ativo + regular).
    const tenant = tenantIds[0];
    const login1 = await request(app).post("/auth/login").send({ telefone: rootTel, senha: ROOT_SENHA });
    const code1 = (lastMessageTo(rootTel) ?? "").match(/(\d{6})/)![1];
    const v1 = await request(app).post("/auth/verify-otp").send({ challengeId: login1.body.challengeId, codigo: code1 });
    expect(v1.status).toBe(200);

    // Desativa a empresa.
    const off = await request(app).patch(`/admin/tenants/${tenant}/desativar`).set(A);
    expect(off.status).toBe(200);
    expect((await owner.query(`SELECT ativo FROM tenants WHERE id=$1`, [tenant])).rows[0].ativo).toBe(false);

    // Agora o login é bloqueado após o 2FA.
    const login2 = await request(app).post("/auth/login").send({ telefone: rootTel, senha: ROOT_SENHA });
    const code2 = (lastMessageTo(rootTel) ?? "").match(/(\d{6})/)![1];
    const v2 = await request(app).post("/auth/verify-otp").send({ challengeId: login2.body.challengeId, codigo: code2 });
    expect(v2.status).toBe(403);
    expect(v2.body.erro).toBe("acesso bloqueado, contatar suporte");

    // Reativa e o login volta a funcionar.
    expect((await request(app).patch(`/admin/tenants/${tenant}/ativar`).set(A)).status).toBe(200);
    const login3 = await request(app).post("/auth/login").send({ telefone: rootTel, senha: ROOT_SENHA });
    const code3 = (lastMessageTo(rootTel) ?? "").match(/(\d{6})/)![1];
    const v3 = await request(app).post("/auth/verify-otp").send({ challengeId: login3.body.challengeId, codigo: code3 });
    expect(v3.status).toBe(200);
  });
});
