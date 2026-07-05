/**
 * Finalidade: configuração central de auth/segurança lida de variáveis de ambiente.
 * Como funciona: expõe um objeto `config` com defaults de desenvolvimento; em produção
 *   os segredos devem vir do ambiente (falha se ausentes com NODE_ENV=production).
 * Relações: consumido por auth/* (senha, OTP, TOTP, tokens), rate limiting e rotas.
 *   Parâmetros de OTP seguem D6; TTLs de sessão seguem D5.
 */
const isProd = process.env.NODE_ENV === "production";

function required(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (isProd) throw new Error(`variável de ambiente obrigatória ausente: ${name}`);
  return devFallback;
}

const num = (name: string, def: number): number => {
  const v = process.env[name];
  return v ? Number(v) : def;
};

export const config = {
  isProd,
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-trocar"),
    accessTtlSeconds: num("ACCESS_TOKEN_TTL_SECONDS", 15 * 60), // D5 (15 min)
    refreshTtlSeconds: num("REFRESH_TOKEN_TTL_SECONDS", 7 * 24 * 3600), // D5 (7 dias)
    preauthTtlSeconds: num("PREAUTH_TTL_SECONDS", 120), // token curto entre senha e 2FA
  },
  otp: {
    length: num("OTP_LENGTH", 6), // D6
    ttlSeconds: num("OTP_TTL_SECONDS", 300), // D6 (5 min)
    maxAttempts: num("OTP_MAX_ATTEMPTS", 5), // D6
    resendCooldownSeconds: num("OTP_RESEND_COOLDOWN_SECONDS", 60), // D6
    pepper: required("OTP_PEPPER", "dev-otp-pepper-trocar"),
  },
  // Pepper para hashear refresh tokens antes de persistir (nunca em claro).
  tokenPepper: required("TOKEN_PEPPER", "dev-token-pepper-trocar"),
  rateLimit: {
    loginWindowMs: num("RL_LOGIN_WINDOW_MS", 15 * 60 * 1000),
    loginMax: num("RL_LOGIN_MAX", 20),
    otpWindowMs: num("RL_OTP_WINDOW_MS", 15 * 60 * 1000),
    otpMax: num("RL_OTP_MAX", 30),
  },
  notificationProvider: process.env.NOTIFICATION_PROVIDER ?? "log", // D17
  paymentProvider: process.env.PAYMENT_PROVIDER ?? "mock", // D19 (mock | mercadopago)
};
