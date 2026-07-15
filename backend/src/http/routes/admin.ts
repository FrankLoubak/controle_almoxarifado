/**
 * Finalidade: rotas do painel super-admin (/admin) — nível plataforma.
 * Como funciona: exige super-admin autenticado (requireSuperAdmin). Lista empresas, faz
 *   onboarding (empresa + Root inicial) e ativa/desativa contas. Valida com zod.
 * Relações: montada em app.ts sob authenticate; usa authorize e adminService.
 */
import { Router } from "express";
import { z } from "zod";
import { createTenant, listTenants, setTenantAtivo } from "../../services/adminService";
import { requireSuperAdmin } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const onboardingSchema = z.object({
  razaoSocial: z.string().min(1),
  cnpj: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().min(3),
  endereco: z.string().optional().nullable(),
  root: z.object({
    nome: z.string().min(1),
    telefone: z.string().min(3),
    senha: z.string().min(6),
  }),
});

function parseId(raw: unknown): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new AppError(400, "id inválido");
  return parsed.data;
}

export function adminRouter(): Router {
  const router = Router();
  router.use(requireSuperAdmin);

  router.get(
    "/tenants",
    asyncHandler(async (_req, res) => {
      res.json(await listTenants());
    }),
  );

  // Onboarding: cria a empresa-cliente + Root inicial (D4).
  router.post(
    "/tenants",
    asyncHandler(async (req, res) => {
      const input = validateBody(onboardingSchema, req.body);
      res.status(201).json(await createTenant(input));
    }),
  );

  router.patch(
    "/tenants/:id/ativar",
    asyncHandler(async (req, res) => {
      res.json(await setTenantAtivo(parseId(req.params.id), true));
    }),
  );

  router.patch(
    "/tenants/:id/desativar",
    asyncHandler(async (req, res) => {
      res.json(await setTenantAtivo(parseId(req.params.id), false));
    }),
  );

  return router;
}
