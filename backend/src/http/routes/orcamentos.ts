/**
 * Finalidade: rotas REST de Orçamento (cadastrar/editar/liberar/recusar/listar).
 * Como funciona: exige almoxarife autenticado; o requisitante do reparo (na liberação) é
 *   o usuário autenticado. Valida payloads com zod e delega ao orcamentoService.
 * Relações: montada em app.ts sob authenticate; usa authorize e orcamentoService.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import {
  cadastrarOrcamento,
  editarOrcamento,
  getOrcamento,
  liberarOrcamento,
  listOrcamentos,
  recusarOrcamento,
} from "../../services/orcamentoService";
import { getTenantId, requireAlmoxarife } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const cadastrarSchema = z.object({
  idFerramenta: z.string().uuid(),
  idPrestador: z.string().uuid(),
  valorOrcamento: z.number().positive(),
  descricaoServico: z.string().optional().nullable(),
});
const editarSchema = z.object({
  valorOrcamento: z.number().positive().optional(),
  descricaoServico: z.string().optional().nullable(),
});
const statusEnum = z.enum(["pendente", "liberado", "recusado"]);

function parseId(raw: unknown): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new AppError(400, "id inválido");
  return parsed.data;
}
function requisitante(req: Request): string {
  const sub = req.auth?.sub;
  if (!sub) throw new AppError(403, "requisitante não identificado");
  return sub;
}

export function orcamentosRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const idFerramenta = typeof req.query.ferramenta === "string" ? req.query.ferramenta : undefined;
      const s = statusEnum.safeParse(req.query.status);
      res.json(await listOrcamentos(getTenantId(req), { idFerramenta, status: s.success ? s.data : undefined }));
    }),
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = validateBody(cadastrarSchema, req.body);
      res.status(201).json(await cadastrarOrcamento(getTenantId(req), input));
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await getOrcamento(getTenantId(req), parseId(req.params.id)));
    }),
  );

  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const input = validateBody(editarSchema, req.body);
      res.json(await editarOrcamento(getTenantId(req), parseId(req.params.id), input));
    }),
  );

  router.post(
    "/:id/liberar",
    asyncHandler(async (req, res) => {
      res.json(await liberarOrcamento(getTenantId(req), requisitante(req), parseId(req.params.id)));
    }),
  );

  router.post(
    "/:id/recusar",
    asyncHandler(async (req, res) => {
      res.json(await recusarOrcamento(getTenantId(req), parseId(req.params.id)));
    }),
  );

  return router;
}
