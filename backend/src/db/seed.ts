/**
 * Finalidade: seed mínimo (1 tenant + super-admin + funcionário Root) para testes/dev.
 * Como funciona: conecta como dono (MIGRATION_URL, superuser que ignora RLS), cria o
 *   tenant, o Root (is_root + status_almoxarife) e amarra Tenant.id_root_funcionario.
 *   senha_hash é placeholder — hashing real entra no Sprint 2 (cybersecurity-agent).
 * Relações: usa schema/index e urls.ts. Rodar via `npm run db:seed`.
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { hashPassword } from "../auth/password";
import { generateTotpSecret } from "../auth/totp";
import { funcionarios, superAdmins, tenants } from "./schema/index";
import { MIGRATION_URL } from "./urls";

const { Pool } = pg;

// Credenciais de desenvolvimento (trocar em produção).
const SENHA_ROOT_DEV = "Root@123";
const SENHA_ADMIN_DEV = "Admin@123";

async function main() {
  const pool = new Pool({ connectionString: MIGRATION_URL });
  const db = drizzle(pool);

  // Super-admin da plataforma (com TOTP habilitado — D16).
  const totp = generateTotpSecret("admin@plataforma.local");
  await db
    .insert(superAdmins)
    .values({
      nome: "Super Admin",
      email: "admin@plataforma.local",
      senhaHash: await hashPassword(SENHA_ADMIN_DEV),
      totpSecret: totp.secret,
      totpEnabled: true,
    })
    .onConflictDoNothing();

  // Tenant de exemplo.
  const [tenant] = await db
    .insert(tenants)
    .values({
      razaoSocial: "Empresa Demonstração LTDA",
      cnpj: "00000000000191",
      email: "contato@demo.local",
      telefone: "+5511999990000",
      endereco: "Rua Exemplo, 100 - São Paulo/SP",
    })
    .returning();

  // Funcionário Root do tenant.
  const [root] = await db
    .insert(funcionarios)
    .values({
      tenantId: tenant.id,
      nome: "Root da Empresa",
      numeroTelefone: "+5511988887777",
      statusAlmoxarife: true,
      isRoot: true,
      senhaHash: await hashPassword(SENHA_ROOT_DEV),
    })
    .returning();

  // Amarra o Root ao tenant.
  await db.update(tenants).set({ idRootFuncionario: root.id }).where(eq(tenants.id, tenant.id));

  await pool.end();
  /* eslint-disable no-console */
  console.log(`seed ok — tenant=${tenant.id} root=${root.id}`);
  console.log(`  Root:  telefone=+5511988887777  senha=${SENHA_ROOT_DEV}`);
  console.log(`  Admin: email=admin@plataforma.local  senha=${SENHA_ADMIN_DEV}`);
  console.log(`  TOTP super-admin (cadastre no app autenticador): ${totp.uri}`);
  /* eslint-enable no-console */
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("falha no seed:", err);
  process.exit(1);
});
