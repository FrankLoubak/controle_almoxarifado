/**
 * Finalidade: rotas REST de Ferramenta (CRUD + ações da máquina de estados).
 * Como funciona: exige almoxarife autenticado; valida payloads com zod e delega ao
 *   ferramentaService (tenant-scoped/RLS). Ações: enviar-reparo, retornar-reparo, sucatear.
 * Relações: montada em app.ts sob authenticate; usa authorize e ferramentaService.
 */
import { Router } from "express";
import { z } from "zod";
import { toolStatusEnum } from "../../db/schema/index";
import {
  createFerramenta,
  enviarParaReparo,
  getFerramenta,
  listFerramentas,
  retornarDoReparo,
  softDeleteFerramenta,
  sucatear,
  updateFerramenta,
} from "../../services/ferramentaService";
import type { ToolStatus } from "../../domain/toolStatusMachine";
import { getTenantId, requireAlmoxarife } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const createSchema = z.object({
  tipo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
});
const updateSchema = createSchema.partial();

function parseId(raw: unknown): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new AppError(400, "id inválido");
  return parsed.data;
}

export function ferramentasRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
      const status = toolStatusEnum.enumValues.includes(statusRaw as ToolStatus)
        ? (statusRaw as ToolStatus)
        : undefined;
      res.json(await listFerramentas(getTenantId(req), { search, status }));
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = validateBody(createSchema, req.body);
      res.status(201).json(await createFerramenta(getTenantId(req), input));
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await getFerramenta(getTenantId(req), parseId(req.params.id)));
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const input = validateBody(updateSchema, req.body);
      res.json(await updateFerramenta(getTenantId(req), parseId(req.params.id), input));
    }),
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await softDeleteFerramenta(getTenantId(req), parseId(req.params.id)));
    }),
  );

  // Ações da máquina de estados (4.6).
  router.post(
    "/:id/enviar-reparo",
    asyncHandler(async (req, res) => {
      res.json(await enviarParaReparo(getTenantId(req), parseId(req.params.id)));
    }),
  );

  router.post(
    "/:id/retornar-reparo",
    asyncHandler(async (req, res) => {
      res.json(await retornarDoReparo(getTenantId(req), parseId(req.params.id)));
    }),
  );

  router.post(
    "/:id/sucatear",
    asyncHandler(async (req, res) => {
      res.json(await sucatear(getTenantId(req), parseId(req.params.id)));
    }),
  );

  return router;
}
