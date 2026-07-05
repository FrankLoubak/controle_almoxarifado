/**
 * Finalidade: regras de negócio da Assinatura do tenant (CLAUDE.md 4.10/5.4).
 * Como funciona: orquestra o PaymentProvider e persiste a entidade Assinatura, mantendo
 *   tenants.status_assinatura (que o login usa para bloquear). Criar/regularizar deixam o
 *   tenant 'regular'; cancelar deixa 'cancelado'. O webhook aplica o status via função
 *   SECURITY DEFINER (sem contexto de tenant).
 * Relações: usado por routes/assinatura e o webhook; usa db/client, schema e payments.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db, withTenant } from "../db/client";
import { assinaturas, tenants } from "../db/schema/index";
import { getPaymentProvider, proximoVencimento, type Plano, type StatusPagamento } from "../payments/index";
import { AppError } from "../http/middleware/errors";

const publicCols = {
  id: assinaturas.id,
  plano: assinaturas.plano,
  status: assinaturas.status,
  dataInicio: assinaturas.dataInicio,
  dataProximoVencimento: assinaturas.dataProximoVencimento,
  providerUsado: assinaturas.providerUsado,
};

async function latest(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], tenantId: string) {
  const [row] = await tx
    .select(publicCols)
    .from(assinaturas)
    .where(eq(assinaturas.tenantId, tenantId))
    .orderBy(desc(assinaturas.dataInicio))
    .limit(1);
  return row ?? null;
}

export async function getAssinatura(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const assinatura = await latest(tx, tenantId);
    const [t] = await tx.select({ status: tenants.statusAssinatura }).from(tenants).where(eq(tenants.id, tenantId));
    return { assinatura, tenantStatus: t?.status ?? null };
  });
}

export async function criarAssinatura(tenantId: string, plano: Plano) {
  const provider = getPaymentProvider();
  const res = await provider.createSubscription(tenantId, plano);
  return withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .insert(assinaturas)
      .values({
        tenantId,
        plano,
        status: "regular",
        dataProximoVencimento: res.dataProximoVencimento,
        providerUsado: provider.nome,
      })
      .returning(publicCols);
    await tx.update(tenants).set({ statusAssinatura: "regular", updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return row;
  });
}

export async function cancelarAssinatura(tenantId: string) {
  const provider = getPaymentProvider();
  await provider.cancelSubscription(tenantId);
  return withTenant(tenantId, async (tx) => {
    const atual = await latest(tx, tenantId);
    if (!atual) throw new AppError(404, "não há assinatura para cancelar");
    await tx.update(assinaturas).set({ status: "cancelado", updatedAt: new Date() }).where(eq(assinaturas.id, atual.id));
    await tx.update(tenants).set({ statusAssinatura: "cancelado", updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return { ...atual, status: "cancelado" as const };
  });
}

// Regularização (mock simula um pagamento aprovado; estende o vencimento pelo plano).
export async function regularizarAssinatura(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const atual = await latest(tx, tenantId);
    if (!atual) throw new AppError(404, "não há assinatura para regularizar");
    const venc = proximoVencimento(atual.plano as Plano);
    await tx
      .update(assinaturas)
      .set({ status: "regular", dataProximoVencimento: venc, updatedAt: new Date() })
      .where(eq(assinaturas.id, atual.id));
    await tx.update(tenants).set({ statusAssinatura: "regular", updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return { ...atual, status: "regular" as const, dataProximoVencimento: venc };
  });
}

// Webhook: aplica o status ao tenant + assinatura sem contexto de tenant (SECURITY DEFINER).
export async function aplicarWebhook(tenantId: string, status: StatusPagamento) {
  await db.execute(sql`SELECT apply_payment_update(${tenantId}::uuid, ${status}::assinatura_status, NULL)`);
}
