# notifications-agent

## Escopo
Implementação da interface `NotificationProvider` (CLAUDE.md 5.3). Impl. inicial:
**Evolution API + n8n**.

## Responsabilidades
- Implementar `sendMessage(destinatario, mensagem, tipo: 'otp' | 'geral')`.
- Cobrir tanto o envio do **código 2FA** quanto notificações gerais.
- Tratar falha de envio com retorno estruturado (`ResultadoEnvio`) — nunca engolir erro
  de canal (o 2FA depende dele).

## Dívida técnica registrada
- Usar Evolution API (canal não-oficial) para 2FA é dívida aceita conscientemente
  (custo zero, infra reaproveitada), com risco de indisponibilidade.
- ⚠️ **GATILHO DE MIGRAÇÃO**: ao atingir **10 tenants ativos**, migrar 2FA para BSP
  oficial (Twilio ou 360dialog). Item de backlog em `sprint-02-auth.md`.
- A troca não altera a lógica de negócio — apenas a classe concreta injetada.

## Regra de manual de API (CLAUDE.md do usuário)
Perguntar ao usuário se há documentação da Evolution API / n8n antes de implementar.

## Referências
- `.claude/CLAUDE.md` seção 5.3.
