/**
 * Finalidade: login do super-admin da plataforma (e-mail+senha → código TOTP).
 * Como funciona: passo 1 valida e-mail+senha e recebe o preauthToken; passo 2 valida o
 *   código TOTP (app autenticador) e estabelece a sessão.
 * Relações: usa AuthContext (loginSuperAdmin/verifyTotp); redireciona para /admin.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Banner, Button, Field, useAsync } from "../components/ui";

export function SuperAdminLoginPage() {
  const { loginSuperAdmin, verifyTotp } = useAuth();
  const nav = useNavigate();
  const { loading, error, run } = useAsync();
  const [etapa, setEtapa] = useState<"senha" | "totp">("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [preauth, setPreauth] = useState("");
  const [codigo, setCodigo] = useState("");

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>Plataforma · Super-admin</h2>
        <Banner kind="error">{error}</Banner>

        {etapa === "senha" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                setPreauth(await loginSuperAdmin(email.trim(), senha));
                setEtapa("totp");
              });
            }}
          >
            <Field label="E-mail" title="E-mail do super-admin da plataforma" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <Field label="Senha" title="Senha do super-admin" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
            <Button title="Prosseguir para a verificação em duas etapas (TOTP)" type="submit" disabled={loading}>
              {loading ? "..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await verifyTotp(preauth, codigo.trim());
                nav("/admin");
              });
            }}
          >
            <p className="muted">Informe o código do seu app autenticador.</p>
            <Field label="Código TOTP" title="Código de 6 dígitos do app autenticador (Google/Microsoft Authenticator)" value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" placeholder="000000" />
            <Button title="Confirmar o código TOTP e acessar o painel" type="submit" disabled={loading}>
              {loading ? "Verificando..." : "Verificar"}
            </Button>{" "}
            <Button title="Voltar e informar e-mail/senha" type="button" variant="secondary" onClick={() => setEtapa("senha")}>
              Voltar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
