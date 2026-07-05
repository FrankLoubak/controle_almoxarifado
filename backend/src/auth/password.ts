/**
 * Finalidade: hashing e verificação de senha (argon2id).
 * Como funciona: wrappers finos sobre a lib argon2 (tipo argon2id por padrão).
 * Relações: usado no login (funcionário e super-admin) e no seed/cadastro (Sprint 3).
 */
import argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
