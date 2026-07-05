/**
 * Finalidade: componentes de UI reutilizáveis (campo, botão, banner, card) com tooltips.
 * Como funciona: wrappers finos sobre elementos nativos; `title`/onMouseOver garantem a
 *   acessibilidade por tooltip exigida (CLAUDE.md 6). useAsync trata loading/erro de ações.
 * Relações: usado por todas as páginas.
 */
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label,
  title,
  ...rest
}: { label: string; title: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} title={title}>
        {label}
      </label>
      <input id={id} title={title} {...rest} />
    </div>
  );
}

export function Button({
  children,
  title,
  variant,
  ...rest
}: {
  children: ReactNode;
  title: string;
  variant?: "secondary" | "danger" | "ok" | "small";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={variant ?? ""} title={title} {...rest}>
      {children}
    </button>
  );
}

export function Banner({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={`banner ${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

// Hook utilitário: executa uma ação assíncrona controlando loading e mensagens.
export function useAsync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run(fn: () => Promise<void>, okMsg?: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      if (okMsg) setSuccess(okMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, success, setError, setSuccess, run };
}
