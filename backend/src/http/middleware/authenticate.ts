/**
 * Finalidade: middleware que autentica requisições via access token (JWT).
 * Como funciona: lê o header Authorization: Bearer, verifica o token e injeta as claims
 *   em req.auth. Sem token válido → 401.
 * Relações: usa auth/tokens; consumido pelas rotas protegidas (ex.: /auth/me).
 */
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessClaims } from "../../auth/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ erro: "token ausente" });
    return;
  }
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ erro: "token inválido ou expirado" });
  }
}
