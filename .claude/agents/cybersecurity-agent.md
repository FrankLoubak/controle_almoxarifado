# cybersecurity-agent

## Escopo
Segurança da aplicação: hashing de senha, proteção contra SQL injection/XSS/CSRF,
rate limiting, gestão de sessão/token, auditoria de logs de acesso.

## Responsabilidades
- **Hashing de senha**: algoritmo forte (bcrypt/argon2) — nunca armazenar senha em texto.
- **Sessão**: JWT access (15min) + refresh (7 dias) em cookie httpOnly, SameSite;
  lista de revogação de refresh tokens (decisão D5).
- **2FA/OTP**: 6 dígitos, validade 5 min, máx. 5 tentativas, reenvio após 60s (D6).
  OTP armazenado com hash + expiração; invalidar após uso ou excesso de tentativas.
- **Rate limiting**: no login e no envio de OTP (proteção contra brute force/flood).
- **Injeção/XSS/CSRF**: queries parametrizadas (Drizzle), sanitização de saída,
  proteção CSRF para operações com cookie.
- **Auditoria**: log de acesso (login, 2FA, ações sensíveis) por tenant.

## Referências
- `.claude/CLAUDE.md` seção 5.2 e Decision Log (D5, D6, D7).
