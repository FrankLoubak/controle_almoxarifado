/**
 * Finalidade: rotas REST de Reparo (interno sem orçamento, conclusão, listagem).
 * Como funciona: exige almoxarife autenticado; requisitante = usuário autenticado.
 *   Valida payloads com zod e delega ao reparoService. A criação de reparo a partir de
 *   orçamento liberado ocorre em /orcamentos/:id/liberar.
 * Relações: montada em app.ts sob authenticate; usa authorize e reparoService.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import {
  concluirReparo,
  iniciarReparoInternoDireto,
  listReparos,
} from "../../services/reparoService";
import { getTenantId, requireAlmoxarife } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const internoDiretoSchema = z.object({
  idFerramenta: z.string().uuid(),
  idPrestador: z.string().uuid(),
});
const concluirSchema = z.object({
  idFerramenta: z.string().uuid(),
  descricaoReparoRealizado: z.string().optional().nullable(),
});

function requisitante(req: Request): string {
  const sub = req.auth?.sub;
  if (!sub) throw new AppError(403, "requisitante não identificado");
  return sub;
}

export function reparosRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const idFerramenta = typeof req.query.ferramenta === "string" ? req.query.ferramenta : undefined;
      res.json(await listReparos(getTenantId(req), idFerramenta));
    }),
  );

  // Reparo interno sem orçamento (regra 11).
  router.post(
    "/interno-direto",
    asyncHandler(async (req, res) => {
      const input = validateBody(internoDiretoSchema, req.body);
      res.status(201).json(await iniciarReparoInternoDireto(getTenantId(req), requisitante(req), input));
    }),
  );

  // Concluir o reparo em aberto da ferramenta.
  router.post(
    "/concluir",
    asyncHandler(async (req, res) => {
      const input = validateBody(concluirSchema, req.body);
      res.json(await concluirReparo(getTenantId(req), input));
    }),
  );

  return router;
}
