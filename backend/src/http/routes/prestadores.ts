/**
 * Finalidade: rotas REST de Prestador (CRUD).
 * Como funciona: exige almoxarife autenticado; valida payloads com zod e delega ao
 *   prestadorService (tenant-scoped/RLS). idFuncionario opcional (roteamento de reparo).
 * Relações: montada em app.ts sob authenticate; usa authorize e prestadorService.
 */
import { Router } from "express";
import { z } from "zod";
import {
  createPrestador,
  getPrestador,
  listPrestadores,
  softDeletePrestador,
  updatePrestador,
} from "../../services/prestadorService";
import { getTenantId, requireAlmoxarife } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const createSchema = z.object({
  nome: z.string().min(1),
  endereco: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  idFuncionario: z.string().uuid().optional().nullable(),
});
const updateSchema = createSchema.partial();

function parseId(raw: unknown): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new AppError(400, "id inválido");
  return parsed.data;
}

export function prestadoresRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      res.json(await listPrestadores(getTenantId(req), search));
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = validateBody(createSchema, req.body);
      res.status(201).json(await createPrestador(getTenantId(req), input));
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await getPrestador(getTenantId(req), parseId(req.params.id)));
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const input = validateBody(updateSchema, req.body);
      res.json(await updatePrestador(getTenantId(req), parseId(req.params.id), input));
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await softDeletePrestador(getTenantId(req), parseId(req.params.id)));
    }),
  );

  return router;
}
