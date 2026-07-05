/**
 * Finalidade: rotas REST de Empréstimo (realizar/encerrar/listar).
 * Como funciona: exige almoxarife autenticado; o emprestador é o próprio usuário
 *   autenticado (regra 3). Valida payloads com zod e delega ao emprestimoService.
 * Relações: montada em app.ts sob authenticate; usa authorize e emprestimoService.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import {
  encerrarEmprestimo,
  getEmprestimo,
  listEmprestimos,
  realizarEmprestimo,
} from "../../services/emprestimoService";
import { getTenantId, requireAlmoxarife } from "../middleware/authorize";
import { AppError, asyncHandler, validateBody } from "../middleware/errors";

const realizarSchema = z.object({
  idFerramenta: z.string().uuid(),
  idDepositario: z.string().uuid(),
});

function parseId(raw: unknown): string {
  const parsed = z.string().uuid().safeParse(raw);
  if (!parsed.success) throw new AppError(400, "id inválido");
  return parsed.data;
}

function emprestadorId(req: Request): string {
  const sub = req.auth?.sub;
  if (!sub) throw new AppError(403, "emprestador não identificado");
  return sub;
}

export function emprestimosRouter(): Router {
  const router = Router();
  router.use(requireAlmoxarife);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const ativo = req.query.ativo === "true";
      const idDepositario =
        typeof req.query.depositario === "string" ? req.query.depositario : undefined;
      const idFerramenta = typeof req.query.ferramenta === "string" ? req.query.ferramenta : undefined;
      res.json(await listEmprestimos(getTenantId(req), { ativo, idDepositario, idFerramenta }));
    }),
  );

  // Realizar empréstimo (emprestador = almoxarife autenticado — regra 3).
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = validateBody(realizarSchema, req.body);
      res.status(201).json(await realizarEmprestimo(getTenantId(req), emprestadorId(req), input));
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await getEmprestimo(getTenantId(req), parseId(req.params.id)));
    }),
  );

  // Encerrar empréstimo ativo (regra 14) → ferramenta volta a disponível (regra 16).
  router.post(
    "/:id/encerrar",
    asyncHandler(async (req, res) => {
      res.json(await encerrarEmprestimo(getTenantId(req), parseId(req.params.id)));
    }),
  );

  return router;
}
