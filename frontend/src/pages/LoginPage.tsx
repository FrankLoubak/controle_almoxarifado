/**
 * Finalidade: tela de Login em 2 passos (telefone+senha → código 2FA por WhatsApp).
 * Como funciona: passo 1 chama login e recebe o challengeId; passo 2 valida o OTP e
 *   estabelece a sessão. Em dev (adapter mock), o código aparece no log do backend.
 * Relações: usa AuthContext (login/verifyOtp); redireciona para "/" ao autenticar.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Banner, Button, Field, useAsync } from "../components/ui";

export function LoginPage() {
  const { login, verifyOtp } = useAuth();
  const nav = useNavigate();
  const { loading, error, run } = useAsync();
  const [etapa, setEtapa] = useState<"senha" | "otp">("senha");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [codigo, setCodigo] = useState("");

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h2>Almoxarifado</h2>
        <Banner kind="error">{error}</Banner>

        {etapa === "senha" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const id = await login(telefone.trim(), senha);
                setChallengeId(id);
                setEtapa("otp");
              });
            }}
          >
            <Field
              label="Telefone"
              title="Telefone cadastrado (com DDD), usado para login e 2FA"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+55119..."
              autoComplete="username"
            />
            <Field
              label="Senha"
              title="Sua senha de almoxarife"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
            <Button title="Enviar código de verificação por WhatsApp" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Entrar"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await verifyOtp(challengeId, codigo.trim());
                nav("/");
              });
            }}
          >
            <p className="muted">Enviamos um código de 6 dígitos por WhatsApp.</p>
            <Field
              label="Código de verificação"
              title="Código de 6 dígitos recebido por WhatsApp (válido por 5 minutos)"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              placeholder="000000"
            />
            <Button title="Confirmar o código e acessar o sistema" type="submit" disabled={loading}>
              {loading ? "Verificando..." : "Verificar"}
            </Button>{" "}
            <Button
              title="Voltar e informar telefone/senha novamente"
              type="button"
              variant="secondary"
              onClick={() => setEtapa("senha")}
            >
              Voltar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
