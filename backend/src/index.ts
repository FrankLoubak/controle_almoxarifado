/**
 * Finalidade: ponto de entrada da API REST do almoxarifado.
 * Como funciona: cria a aplicação Express (app.ts) e escuta na porta configurada.
 * Relações: usa createApp (rotas de auth + healthcheck). Rotas de negócio entram no
 *   Sprint 3+ sobre esta mesma app.
 */
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`almoxarifado-backend ouvindo na porta ${port}`);
});
