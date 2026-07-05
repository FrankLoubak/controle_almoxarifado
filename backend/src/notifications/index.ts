/**
 * Finalidade: factory que seleciona a implementação de NotificationProvider por env (D17).
 * Como funciona: lê config.notificationProvider (log|evolution) e devolve um singleton.
 * Relações: usado pelo serviço de auth; troca de canal sem alterar a lógica de negócio.
 */
import { config } from "../config/env";
import { EvolutionNotificationProvider } from "./evolutionProvider";
import { LogNotificationProvider } from "./logProvider";
import type { NotificationProvider } from "./provider";

let instance: NotificationProvider | undefined;

export function getNotificationProvider(): NotificationProvider {
  if (!instance) {
    instance =
      config.notificationProvider === "evolution"
        ? new EvolutionNotificationProvider()
        : new LogNotificationProvider();
  }
  return instance;
}

export * from "./provider";
