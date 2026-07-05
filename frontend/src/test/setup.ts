/**
 * Finalidade: setup global dos testes do frontend.
 * Como funciona: registra os matchers do jest-dom e limpa o DOM entre os testes.
 * Relações: referenciado por vite.config.ts (test.setupFiles).
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
