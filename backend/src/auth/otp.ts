/**
 * Finalidade: geração e verificação do código OTP de 2FA (WhatsApp) — D6.
 * Como funciona: gera código numérico aleatório; persiste apenas o HMAC-SHA256 (com
 *   pepper), nunca o código em claro. Comparação em tempo constante.
 * Relações: usado pelo serviço de auth (challenge de OTP em otp_challenges).
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "../config/env";

export function generateOtp(): string {
  const max = 10 ** config.otp.length;
  return randomInt(0, max).toString().padStart(config.otp.length, "0");
}

export function hashOtp(code: string): string {
  return createHmac("sha256", config.otp.pepper).update(code).digest("hex");
}

export function verifyOtp(code: string, expectedHash: string): boolean {
  const a = Buffer.from(hashOtp(code), "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
