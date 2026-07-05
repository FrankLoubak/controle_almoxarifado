/**
 * Finalidade: raiz da aplicação — roteamento, layout e proteção de rotas.
 * Como funciona: enquanto a sessão carrega, mostra "carregando"; rotas protegidas exigem
 *   autenticação (senão redireciona ao login). O layout tem navegação lateral e logout.
 * Relações: usa AuthContext; compõe as páginas operacionais e placeholders.
 */
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Button } from "./components/ui";
import { CadastrarPage } from "./pages/CadastrarPage";
import { EmprestarPage } from "./pages/EmprestarPage";
import { FerramentasPage } from "./pages/FerramentasPage";
import { AssinaturaPage } from "./pages/AssinaturaPage";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";

function Layout() {
  const { claims, logout } = useAuth();
  const nav = useNavigate();
  const papel = claims?.isRoot ? "Root" : claims?.isAlmoxarife ? "Almoxarife" : "Usuário";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Almoxarifado</h1>
        <nav>
          <NavLink to="/" end title="Página inicial">Início</NavLink>
          <NavLink to="/cadastrar" title="Cadastrar funcionários e prestadores">Cadastrar</NavLink>
          <NavLink to="/emprestar" title="Realizar e encerrar empréstimos">Emprestar</NavLink>
          <NavLink to="/ferramentas" title="Ferramentas, reparos e orçamentos">Ferramentas</NavLink>
          <NavLink to="/relatorios" title="Relatórios e exportação CSV">Relatórios</NavLink>
          <NavLink to="/assinatura" title="Assinatura da empresa (em breve)">Assinatura</NavLink>
        </nav>
        <div className="spacer" />
        <div className="muted" style={{ color: "#94a3b8", padding: "0 8px" }} title="Perfil do usuário logado">
          {papel}
        </div>
        <Button
          title="Encerrar a sessão"
          variant="secondary"
          onClick={async () => {
            await logout();
            nav("/login");
          }}
        >
          Sair
        </Button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

function Home() {
  const { claims } = useAuth();
  return (
    <div>
      <h2>Bem-vindo</h2>
      <p className="muted">
        Sistema de gestão de almoxarifado. Use o menu para cadastrar pessoas, emprestar
        ferramentas e gerenciar reparos.
      </p>
      {claims?.isRoot && <p className="badge">Você é o Root da empresa</p>}
    </div>
  );
}

function ProtectedRoute() {
  const { status } = useAuth();
  if (status === "loading") return <div className="login-wrap">carregando…</div>;
  if (status === "anon") return <Navigate to="/login" replace />;
  return <Layout />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/cadastrar" element={<CadastrarPage />} />
        <Route path="/emprestar" element={<EmprestarPage />} />
        <Route path="/ferramentas" element={<FerramentasPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/assinatura" element={<AssinaturaPage />} />
        <Route
          path="/super-admin"
          element={<PlaceholderPage titulo="Painel do super-admin" descricao="Gestão de empresas-cliente e cobrança da plataforma. Requer endpoints de gestão de tenants (sprint futuro)." />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
