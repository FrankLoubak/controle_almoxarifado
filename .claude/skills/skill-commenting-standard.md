# skill-commenting-standard

Padrão **obrigatório** de comentário de cabeçalho em **todo** arquivo de código do
projeto (frontend e backend).

## Regras de idioma
- **Comentários**: português.
- **Identificadores** (variáveis, funções, classes, tabelas, colunas): inglês.

## Cabeçalho obrigatório
Todo arquivo de código começa com um bloco de comentário contendo:
1. **Finalidade** — o que este arquivo/módulo faz.
2. **Como funciona** — resumo do funcionamento.
3. **Relações** — com quais outros módulos/classes/serviços se relaciona.

### Exemplo (TypeScript)
```ts
/**
 * Finalidade: serviço de empréstimos — realizar e encerrar empréstimo de ferramenta.
 * Como funciona: valida regras de negócio (status disponível, almoxarife emprestador),
 *   altera o status da ferramenta e persiste o registro via repositório Drizzle.
 * Relações: usa toolStatusMachine (transições), toolRepository e loanRepository;
 *   consumido por loanController (rotas REST).
 */
```

### Exemplo (React/TSX)
```tsx
/**
 * Finalidade: tela de Empréstimo — busca ferramenta e depositário e registra o empréstimo.
 * Como funciona: formulário controlado com tooltips (title/onMouseOver); chama a API
 *   /loans ao submeter.
 * Relações: consome loansApi; usa componentes SearchTool e SearchEmployee.
 */
```

## Motivação
Manter o padrão já usado nos demais projetos do usuário — legibilidade e rastreio de
dependências entre módulos.
