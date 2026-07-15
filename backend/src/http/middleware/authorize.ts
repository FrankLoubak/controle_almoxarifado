/**
 * Finalidade: middlewares de autorização por papel (funcionário/almoxarife/Root).
 * Como funciona: leem req.auth (preenchido por authenticate) e barram quem não tem o
 *   papel exigido. Root implica almoxarife (D14). Expõem também getTenantId.
 * Relações: usados pelas rotas de funcionário e prestador (Sprint 3+). Regras 5/6/7.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errors";

export function requireFuncionario(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.type !== "funcionario") throw new AppError(403, "acesso restrito a funcionários");
  next();
}

export function requireAlmoxarife(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.type !== "funcionario" || !req.auth.isAlmoxarife) {
    throw new AppError(403, "acesso restrito a almoxarifes");
  }
  next();
}

export function requireRoot(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.type !== "funcionario" || !req.auth.isRoot) {
    throw new AppError(403, "acesso restrito ao Root da empresa");
  }
  next();
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.type !== "super_admin") throw new AppError(403, "acesso restrito ao super-admin");
  next();
}

// tenantId garantido para funcionários autenticados.
export function getTenantId(req: Request): string {
  const t = req.auth?.tenantId;
  if (!t) throw new AppError(403, "contexto de tenant ausente");
  return t;
}
