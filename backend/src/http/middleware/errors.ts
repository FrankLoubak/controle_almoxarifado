/**
 * Finalidade: erro de aplicação tipado + middleware de tratamento de erros e validação zod.
 * Como funciona: AppError carrega status + mensagem; errorHandler formata a resposta;
 *   validateBody roda um schema zod e lança 400 em caso de payload inválido.
 * Relações: usado por todas as rotas de auth.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

// Envolve handlers async para propagar rejeições ao errorHandler do Express.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function validateBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, "dados inválidos");
  }
  return parsed.data;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error("erro não tratado:", err);
  res.status(500).json({ erro: "erro interno" });
}
