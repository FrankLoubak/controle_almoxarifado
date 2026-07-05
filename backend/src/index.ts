/**
 * Finalidade: ponto de entrada da API REST do almoxarifado (esqueleto Sprint 0).
 * Como funciona: sobe um servidor Express com um healthcheck; rotas de negócio serão
 *   adicionadas a partir do Sprint 2 (auth) em diante.
 * Relações: futuro consumidor de db/ (Drizzle), providers de notificação e pagamento,
 *   e das rotas por domínio (funcionário, ferramenta, empréstimo, reparo).
 */
import express from "express";

const app = express();
app.use(express.json());

// Healthcheck — usado por smoke test e canary de deploy.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "almoxarifado-backend" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`almoxarifado-backend ouvindo na porta ${port}`);
});
