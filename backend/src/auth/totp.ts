/**
 * Finalidade: geração de segredo e verificação de código TOTP (2FA do super-admin — D16).
 * Como funciona: usa a lib otpauth (RFC 6238), janela ±1 período (30s) para tolerar clock.
 * Relações: usado no login do super-admin e no seed (provisiona o segredo).
 */
import { Secret, TOTP } from "otpauth";

const ISSUER = "Almoxarifado";

function build(secretBase32: string, label = "super-admin"): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

// Gera um novo segredo (base32) e a URL otpauth:// para cadastro no app autenticador.
export function generateTotpSecret(label = "super-admin"): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 });
  const totp = build(secret.base32, label);
  return { secret: secret.base32, uri: totp.toString() };
}

export function verifyTotp(secretBase32: string, token: string): boolean {
  const delta = build(secretBase32).validate({ token, window: 1 });
  return delta !== null;
}

// Utilitário para testes/dev: gera o código válido do momento.
export function currentTotp(secretBase32: string): string {
  return build(secretBase32).generate();
}
