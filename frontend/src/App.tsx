/**
 * Finalidade: raiz da aplicação — roteamento e layout por tipo de usuário.
 * Como funciona: enquanto a sessão carrega, mostra "carregando"; anônimo vê os logins
 *   (funcionário e super-admin); autenticado vê o app operacional (funcionário) OU o painel
 *   da plataforma (super-admin), cada um com seu layout.
 * Relações: usa AuthContext; compõe as páginas operacionais e o painel super-admin.
 */
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Button } from "./components/ui";
import { AdminPanelPage } from "./pages/AdminPanelPage";
import { AssinaturaPage } from "./pages/AssinaturaPage";
import { CadastrarPage } from "./pages/CadastrarPage";
import { EmprestarPage } from "./pages/EmprestarPage";
import { FerramentasPage } from "./pages/FerramentasPage";
import { LoginPage } from "./pages/LoginPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { SuperAdminLoginPage } from "./pages/SuperAdminLoginPage";

function Sair() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return (
    <Button title="Encerrar a sessão" variant="secondary" onClick={async () => { await logout(); nav("/login"); }}>
      Sair
    </Button>
  );
}

function Layout() {
  const { claims } = useAuth();
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
          <NavLink to="/assinatura" title="Assinatura da empresa">Assinatura</NavLink>
        </nav>
        <div className="spacer" />
        <div className="muted" style={{ color: "#94a3b8", padding: "0 8px" }} title="Perfil do usuário logado">{papel}</div>
        <Sair />
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}

function AdminLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Plataforma</h1>
        <nav>
          <NavLink to="/admin" end title="Gestão de empresas-cliente">Empresas</NavLink>
        </nav>
        <div className="spacer" />
        <div className="muted" style={{ color: "#94a3b8", padding: "0 8px" }} title="Perfil logado">Super-admin</div>
        <Sair />
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}

function Home() {
  const { claims } = useAuth();
  return (
    <div>
      <h2>Bem-vindo</h2>
      <p className="muted">Use o menu para cadastrar pessoas, emprestar ferramentas e gerenciar reparos.</p>
      {claims?.isRoot && <p className="badge">Você é o Root da empresa</p>}
    </div>
  );
}

export function App() {
  const { status, claims } = useAuth();
  if (status === "loading") return <div className="login-wrap">carregando…</div>;

  if (status === "anon") {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<SuperAdminLoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (claims?.type === "super_admin") {
    return (
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminPanelPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/cadastrar" element={<CadastrarPage />} />
        <Route path="/emprestar" element={<EmprestarPage />} />
        <Route path="/ferramentas" element={<FerramentasPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/assinatura" element={<AssinaturaPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
