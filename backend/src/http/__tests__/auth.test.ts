/**
 * Finalidade: teste de integração da autenticação (fluxo crítico do Sprint 2).
 * Como funciona: cria fixtures via conexão do dono (tenant regular, tenant atrasado,
 *   funcionários e super-admin com TOTP) e exercita as rotas via supertest — login+OTP,
 *   refresh/logout, bloqueio por pagamento, TOTP do super-admin e rate limiting. O OTP é
 *   lido do LogNotificationProvider (adapter mock).
 * Relações: exercita app.ts, rotas de auth, auth/* e authRepo. Requer Postgres + migrations.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../../auth/password";
import { currentTotp, generateTotpSecret } from "../../auth/totp";
import { createApp } from "../../app";
import { pool } from "../../db/client";
import { MIGRATION_URL } from "../../db/urls";
import { lastMessageTo } from "../../notifications/logProvider";

const { Pool } = pg;
const owner = new Pool({ connectionString: MIGRATION_URL });
const app = createApp();

const digits = () => randomUUID().replace(/\D/g, "").padEnd(14, "0").slice(0, 14);
const phoneRegular = `+55119${digits().slice(0, 8)}`;
const phoneBlocked = `+55219${digits().slice(0, 8)}`;
const SENHA = "Senha@123";
const adminEmail = `admin_${digits().slice(0, 6)}@x.local`;
const ADMIN_SENHA = "Admin@123";
const totp = generateTotpSecret(adminEmail);

let tenantRegular: string;
let tenantBlocked: string;
const funcIds: string[] = [];
let adminId: string;

async function createTenant(status: string): Promise<string> {
  const r = await owner.query(
    `INSERT INTO tenants (razao_social, cnpj, email, telefone, status_assinatura)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [`T ${digits()}`, digits(), "t@x.local", "+550", status],
  );
  return r.rows[0].id as string;
}

async function createFunc(tenantId: string, phone: string): Promise<string> {
  const r = await owner.query(
    `INSERT INTO funcionarios (tenant_id, nome, numero_telefone, status_almoxarife, is_root, senha_hash)
     VALUES ($1,$2,$3,true,true,$4) RETURNING id`,
    [tenantId, "Root", phone, await hashPassword(SENHA)],
  );
  const id = r.rows[0].id as string;
  funcIds.push(id);
  return id;
}

function otpFrom(phone: string): string {
  const msg = lastMessageTo(phone) ?? "";
  const m = msg.match(/(\d{6})/);
  if (!m) throw new Error(`OTP não encontrado na mensagem: "${msg}"`);
  return m[1];
}

beforeAll(async () => {
  tenantRegular = await createTenant("regular");
  tenantBlocked = await createTenant("atrasado");
  await createFunc(tenantRegular, phoneRegular);
  await createFunc(tenantBlocked, phoneBlocked);
  const r = await owner.query(
    `INSERT INTO super_admins (nome, email, senha_hash, totp_secret, totp_enabled)
     VALUES ($1,$2,$3,$4,true) RETURNING id`,
    ["Admin", adminEmail, await hashPassword(ADMIN_SENHA), totp.secret],
  );
  adminId = r.rows[0].id as string;
});

afterAll(async () => {
  await owner.query(`DELETE FROM otp_challenges WHERE funcionario_id = ANY($1::uuid[])`, [funcIds]);
  await owner.query(`DELETE FROM refresh_tokens WHERE subject_id = ANY($1::uuid[])`, [
    [...funcIds, adminId],
  ]);
  await owner.query(`DELETE FROM funcionarios WHERE id = ANY($1::uuid[])`, [funcIds]);
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [[tenantRegular, tenantBlocked]]);
  await owner.query(`DELETE FROM super_admins WHERE id = $1`, [adminId]);
  await owner.end();
  await pool.end();
});

describe("Auth funcionário/Root", () => {
  it("login + OTP + acesso protegido (happy path)", async () => {
    const login = await request(app).post("/auth/login").send({ telefone: phoneRegular, senha: SENHA });
    expect(login.status).toBe(200);
    const codigo = otpFrom(phoneRegular);

    const verify = await request(app)
      .post("/auth/verify-otp")
      .send({ challengeId: login.body.challengeId, codigo });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    const cookie = verify.headers["set-cookie"];
    expect(cookie).toBeTruthy();

    const me = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${verify.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.auth.type).toBe("funcionario");
    expect(me.body.auth.isRoot).toBe(true);
    expect(me.body.auth.tenantId).toBe(tenantRegular);
  });

  it("senha incorreta → 401", async () => {
    const r = await request(app).post("/auth/login").send({ telefone: phoneRegular, senha: "errada" });
    expect(r.status).toBe(401);
  });

  it("OTP incorreto → 401", async () => {
    const login = await request(app).post("/auth/login").send({ telefone: phoneRegular, senha: SENHA });
    const r = await request(app)
      .post("/auth/verify-otp")
      .send({ challengeId: login.body.challengeId, codigo: "000000" });
    expect(r.status).toBe(401);
  });

  it("desafio inexistente → 400", async () => {
    const r = await request(app)
      .post("/auth/verify-otp")
      .send({ challengeId: randomUUID(), codigo: "123456" });
    expect(r.status).toBe(400);
  });

  it("refresh rotaciona e logout revoga", async () => {
    const login = await request(app).post("/auth/login").send({ telefone: phoneRegular, senha: SENHA });
    const verify = await request(app)
      .post("/auth/verify-otp")
      .send({ challengeId: login.body.challengeId, codigo: otpFrom(phoneRegular) });
    const cookie = verify.headers["set-cookie"];

    const refreshed = await request(app).post("/auth/refresh").set("Cookie", cookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    const newCookie = refreshed.headers["set-cookie"];

    // O refresh antigo foi revogado (rotação).
    const reuseOld = await request(app).post("/auth/refresh").set("Cookie", cookie);
    expect(reuseOld.status).toBe(401);

    const logout = await request(app).post("/auth/logout").set("Cookie", newCookie);
    expect(logout.status).toBe(200);
    const afterLogout = await request(app).post("/auth/refresh").set("Cookie", newCookie);
    expect(afterLogout.status).toBe(401);
  });

  it("pagamento atrasado bloqueia após o 2FA (403)", async () => {
    const login = await request(app).post("/auth/login").send({ telefone: phoneBlocked, senha: SENHA });
    expect(login.status).toBe(200);
    const verify = await request(app)
      .post("/auth/verify-otp")
      .send({ challengeId: login.body.challengeId, codigo: otpFrom(phoneBlocked) });
    expect(verify.status).toBe(403);
    expect(verify.body.erro).toBe("acesso bloqueado, contatar suporte");
  });
});

describe("Auth super-admin (TOTP)", () => {
  it("login + TOTP emite sessão", async () => {
    const login = await request(app)
      .post("/auth/super-admin/login")
      .send({ email: adminEmail, senha: ADMIN_SENHA });
    expect(login.status).toBe(200);
    expect(login.body.preauthToken).toBeTruthy();

    const verify = await request(app)
      .post("/auth/super-admin/verify-totp")
      .send({ preauthToken: login.body.preauthToken, codigo: currentTotp(totp.secret) });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
  });

  it("TOTP incorreto → 401", async () => {
    const login = await request(app)
      .post("/auth/super-admin/login")
      .send({ email: adminEmail, senha: ADMIN_SENHA });
    const verify = await request(app)
      .post("/auth/super-admin/verify-totp")
      .send({ preauthToken: login.body.preauthToken, codigo: "000000" });
    expect(verify.status).toBe(401);
  });
});

describe("Rate limiting", () => {
  it("bloqueia após exceder o limite de login (429)", async () => {
    const limited = createApp({ rateLimit: { loginMax: 2, windowMs: 60_000 } });
    await request(limited).post("/auth/login").send({ telefone: phoneRegular, senha: "x" });
    await request(limited).post("/auth/login").send({ telefone: phoneRegular, senha: "x" });
    const third = await request(limited).post("/auth/login").send({ telefone: phoneRegular, senha: "x" });
    expect(third.status).toBe(429);
  });
});
