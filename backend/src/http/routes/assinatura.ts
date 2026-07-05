/**
 * Finalidade: rotas de Assinatura (Root) e o webhook público de pagamento.
 * Como funciona: /assinatura exige Root (gestão exclusiva — 5.2): consultar, criar,
 *   cancelar e regularizar. O webhook é público (chamado pelo gateway): interpreta a
 *   notificação via PaymentProvider e aplica o status.
 * Relações: montadas em app.ts; usam assinaturaService, payments e authorize.
 */
import { Router } from "express";
import { z } from "zod";
import { getPaymentProvider } from "../../payments/index";
import {
  aplicarWebhook,
  cancelarAssinatura,
  criarAssinatura,
  getAssinatura,
  regularizarAssinatura,
} from "../../services/assinaturaService";
import { getTenantId, requireRoot } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const planoSchema = z.object({ plano: z.enum(["mensal", "anual"]) });

// Rotas autenticadas (Root) — montar sob authenticate.
export function assinaturaRouter(): Router {
  const router = Router();
  router.use(requireRoot);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      res.json(await getAssinatura(getTenantId(req)));
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const { plano } = validateBody(planoSchema, req.body);
      res.status(201).json(await criarAssinatura(getTenantId(req), plano));
    }),
  );

  router.post(
    "/cancelar",
    asyncHandler(async (req, res) => {
      res.json(await cancelarAssinatura(getTenantId(req)));
    }),
  );

  router.post(
    "/regularizar",
    asyncHandler(async (req, res) => {
      res.json(await regularizarAssinatura(getTenantId(req)));
    }),
  );

  return router;
}

// Webhook público do gateway (sem autenticação de tenant).
export function pagamentosWebhookRouter(): Router {
  const router = Router();
  router.post(
    "/webhook",
    asyncHandler(async (req, res) => {
      const parsed = getPaymentProvider().parseWebhook(req.headers, req.body);
      if (!parsed) throw new AppError(400, "webhook inválido");
      await aplicarWebhook(parsed.tenantId, parsed.status);
      res.json({ ok: true });
    }),
  );
  return router;
}
