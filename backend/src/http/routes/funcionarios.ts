/**
 * Finalidade: rotas REST de Funcionário (CRUD + promoção a almoxarife).
 * Como funciona: exige almoxarife autenticado (Root incluso); a promoção exige Root.
 *   Valida payloads com zod e delega ao funcionarioService (tenant-scoped/RLS).
 * Relações: montada em app.ts sob authenticate; usa authorize e funcionarioService.
 */
import { Router } from "express";
import { z } from "zod";
import {
  createFuncionario,
  getFuncionario,
  listFuncionarios,
  promoteToAlmoxarife,
  softDeleteFuncionario,
  updateFuncionario,
} from "../../services/funcionarioService";
import { getTenantId, requireAlmoxarife, requireRoot } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const createSchema = z.object({
  nome: z.string().min(1),
  numeroTelefone: z.string().min(3),
  cpf: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  dataAdmissao: z.string().optional().nullable(),
});
const updateSchema = createSchema.partial();
const promoteSchema = z.object({ senha: z.string().min(6) });

function parseId(raw: unknown): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new AppError(400, "id inválido");
  return parsed.data;
}

export function funcionariosRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json(await listFuncionarios(getTenantId(req), search));
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = validateBody(createSchema, req.body);
      res.status(201).json(await createFuncionario(getTenantId(req), input));
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await getFuncionario(getTenantId(req), parseId(req.params.id)));
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const input = validateBody(updateSchema, req.body);
      res.json(await updateFuncionario(getTenantId(req), parseId(req.params.id), input));
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await softDeleteFuncionario(getTenantId(req), parseId(req.params.id)));
    }),
  );

  // Promoção a almoxarife — exclusiva do Root (regra 5), exige senha (4.2).
  router.post(
    "/:id/promover",
    requireRoot,
    asyncHandler(async (req, res) => {
      const { senha } = validateBody(promoteSchema, req.body);
      res.json(await promoteToAlmoxarife(getTenantId(req), parseId(req.params.id), senha));
    }),
  );

  return router;
}
