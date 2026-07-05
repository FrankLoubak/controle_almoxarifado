# frontend-agent

## Escopo
React + TypeScript + Vite. Telas descritas na seção 6 do `CLAUDE.md`.

## Responsabilidades
- Implementar as telas: Login/2FA, Cadastrar (funcionário/prestador), Emprestar,
  Ferramentas (com fluxo de reparo), Assinatura (Root), Painel super-admin, Relatórios.
- Consumir a API REST do `backend-agent`.
- Gerenciar sessão via cookie httpOnly (refresh) + access token em memória.

## Convenções obrigatórias
- **Acessibilidade**: `title`/tooltip via `onMouseOver` em **todos** os campos e botões.
- Comentário de cabeçalho em todo arquivo (ver skill-commenting-standard).
- Comentários em português; identificadores em inglês.
- Design limpo e intuitivo.

## Limites
- Não define regra de negócio; consome contratos do backend.
- Não decide modelagem — apenas UI/UX dentro do especificado.

## Referências
- `.claude/CLAUDE.md` seções 3 e 6.
