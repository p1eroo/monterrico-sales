import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet, useParams } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAppStore } from '@/store';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModuleGate } from '@/components/layout/ModuleGate';
import { AreaGate } from '@/components/layout/AreaGate';
import { AppUpdateBanner } from '@/components/system/AppUpdateBanner';

const MainLayout = lazy(() => import('@/components/layout/MainLayout'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Dashboard = lazy(() => import('@/pages/comercial/Dashboard'));
const Contactos = lazy(() => import('@/pages/comercial/Contactos'));
const ContactoDetail = lazy(() => import('@/pages/comercial/ContactoDetail'));
const Empresas = lazy(() => import('@/pages/comercial/Empresas'));
const EmpresaDetail = lazy(() => import('@/pages/comercial/EmpresaDetail'));
const Pipeline = lazy(() => import('@/pages/comercial/Pipeline'));

const Tareas = lazy(() => import('@/pages/comercial/Tareas'));
const Calendario = lazy(() => import('@/pages/comercial/Calendario'));
const Opportunities = lazy(() => import('@/pages/comercial/Opportunities'));
const OportunidadDetail = lazy(() => import('@/pages/comercial/OportunidadDetail'));
// const Clients = lazy(() => import('@/pages/comercial/Clients'));
const ClienteEmpresas = lazy(() => import('@/pages/comercial/ClienteEmpresas'));
const ClienteEmpresaDetail = lazy(() => import('@/pages/comercial/ClienteEmpresaDetail'));
const ClienteContactos = lazy(() => import('@/pages/comercial/ClienteContactos'));
const ClienteContactoDetail = lazy(() => import('@/pages/comercial/ClienteContactoDetail'));
const ClienteTareas = lazy(() => import('@/pages/comercial/ClienteTareas'));
const Reports = lazy(() => import('@/pages/comercial/Reports'));
const Team = lazy(() => import('@/pages/comercial/Team'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const Users = lazy(() => import('@/pages/admin/Users'));
const UserDetail = lazy(() => import('@/pages/admin/UserDetail'));
const Audit = lazy(() => import('@/pages/admin/Audit'));
const Inbox = lazy(() => import('@/pages/comercial/Inbox'));
const CampaignHistory = lazy(() => import('@/pages/comercial/CampaignHistory'));
const CampaignBuilder = lazy(() => import('@/pages/comercial/CampaignBuilder'));
const CampaignResults = lazy(() => import('@/pages/comercial/CampaignResults'));
const Profile = lazy(() => import('@/pages/comercial/Profile'));
const Settings = lazy(() => import('@/pages/comercial/Settings'));
const UiMocks = lazy(() => import('@/pages/comercial/UiMocks'));
const Files = lazy(() => import('@/pages/comercial/Files'));
const AgentesIa = lazy(() => import('@/pages/comercial/AgentesIa'));
const AgentesIaWorkflow = lazy(() => import('@/pages/comercial/AgentesIaWorkflow'));
const FlotaDashboard = lazy(() => import('@/pages/flota/FlotaDashboard'));
const FlotaProspectos = lazy(() => import('@/pages/flota/FlotaProspectos'));
const FlotaProspectoDetail = lazy(() => import('@/pages/flota/FlotaProspectoDetail'));
const FlotaConductores = lazy(() => import('@/pages/flota/FlotaConductores'));
const FlotaReportes = lazy(() => import('@/pages/flota/FlotaReportes'));
const FlotaMensajes = lazy(() => import('@/pages/flota/FlotaMensajes'));
const FlotaChatpool = lazy(() => import('@/pages/flota/FlotaChatpool'));
const FlotaIntegracionesLayout = lazy(() => import('@/pages/flota/FlotaIntegracionesLayout'));
const FlotaIntegracionEvolution = lazy(() => import('@/pages/flota/FlotaIntegracionEvolution'));
const FlotaCalendario = lazy(() => import('@/pages/flota/FlotaCalendario'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const MarketingDashboard = lazy(() => import('@/pages/marketing/MarketingDashboard'));
const MarketingLeads = lazy(() => import('@/pages/marketing/MarketingLeads'));
const MarketingIntegrations = lazy(() => import('@/pages/marketing/MarketingIntegrations'));
const MarketingFacebook = lazy(() => import('@/pages/marketing/MarketingFacebook'));
const MarketingPersonal = lazy(() => import('@/pages/marketing/MarketingPersonal'));
const AreaSelect = lazy(() => import('@/pages/AreaSelect'));
const GoogleAuthCallback = lazy(() => import('@/pages/GoogleAuthCallback'));

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const hasToken =
    typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
  if (!isAuthenticated && !hasToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/area-select" replace />;
  return <>{children}</>;
}

function LegacyDetailRedirect({ basePath }: { basePath: string }) {
  const { id } = useParams();
  if (!id) return <Navigate to={basePath} replace />;
  return <Navigate to={`${basePath}/${id}`} replace />;
}

function MainRoutes() {
  const location = useLocation();
  const setArea = useAppStore((s) => s.setArea);

  useEffect(() => {
    if (location.pathname.startsWith('/flota')) {
      setArea('flota');
    } else if (location.pathname.startsWith('/marketing')) {
      setArea('marketing');
    } else if (location.pathname.startsWith('/admin')) {
      setArea('admin');
    } else {
      setArea('comercial');
    }
  }, [location.pathname, setArea]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/auth/callback"
        element={<GoogleAuthCallback />}
      />
      <Route
        path="/privacy-policy"
        element={<PrivacyPolicy />}
      />
      <Route
        path="/terms-of-service"
        element={<TermsOfService />}
      />
      <Route
        path="/area-select"
        element={
          <ProtectedRoute>
            <AreaSelect />
          </ProtectedRoute>
        }
      />
      <Route element={<ProtectedRoute><AreaGate /></ProtectedRoute>}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Contactos />} />
        <Route path="/contacts/:id" element={<ContactoDetail />} />
        <Route path="/contactos" element={<Navigate to="/contacts" replace />} />
        <Route path="/contactos/:id" element={<LegacyDetailRedirect basePath="/contacts" />} />
        <Route path="/companies" element={<Empresas />} />
        <Route path="/companies/:id" element={<EmpresaDetail />} />
        <Route path="/empresas" element={<Navigate to="/companies" replace />} />
        <Route path="/empresas/:id" element={<LegacyDetailRedirect basePath="/companies" />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/tareas" element={<Tareas />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/opportunities/:id" element={<OportunidadDetail />} />
        <Route path="/clients" element={<Navigate to="/clients/companies" replace />} />
        <Route path="/clients/companies" element={<ClienteEmpresas />} />
        <Route path="/clients/companies/:id" element={<ClienteEmpresaDetail />} />
        <Route path="/clients/contacts" element={<ClienteContactos />} />
        <Route path="/clients/contacts/:id" element={<ClienteContactoDetail />} />
        <Route path="/clients/tareas" element={<ClienteTareas />} />
        <Route path="/clientes" element={<Navigate to="/clients/companies" replace />} />
        <Route path="/clientes/empresas" element={<Navigate to="/clients/companies" replace />} />
        <Route path="/clientes/empresas/:id" element={<LegacyDetailRedirect basePath="/clients/companies" />} />
        <Route path="/clientes/contactos" element={<Navigate to="/clients/contacts" replace />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/team" element={<Team />} />
        
        {/* Rutas de Administración */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/users/:id" element={<UserDetail />} />
        <Route path="/admin/audit" element={<Audit />} />

        <Route path="/inbox" element={<Inbox />} />
        <Route path="/campaigns" element={<CampaignHistory />} />
        <Route path="/campaigns/new" element={<CampaignBuilder />} />
        <Route path="/campaigns/:id/results" element={<CampaignResults />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/dev/mocks" element={<UiMocks />} />
        <Route path="/archivos" element={<Files />} />
        <Route path="/agentes-ia" element={<AgentesIa />} />
        <Route path="/integraciones/apollo" element={<Navigate to="/agentes-ia" replace />} />
        <Route path="/flota" element={<Navigate to="/flota/dashboard" replace />} />
        <Route path="/flota/dashboard" element={<FlotaDashboard />} />
        <Route path="/flota/prospectos" element={<FlotaProspectos />} />
        <Route path="/flota/prospectos/:id" element={<FlotaProspectoDetail />} />
        <Route path="/flota/conductores" element={<FlotaConductores />} />
        <Route path="/flota/reportes" element={<FlotaReportes />} />
        <Route path="/flota/calendario" element={<FlotaCalendario />} />
        <Route path="/flota/whatsapp" element={<FlotaChatpool />} />
        <Route path="/flota/integraciones" element={<FlotaIntegracionesLayout />}>
          <Route index element={<Navigate to="evolution" replace />} />
          <Route path="evolution" element={<FlotaIntegracionEvolution />} />
        </Route>
        <Route path="/flota/bandeja/*" element={<Navigate to="/flota/whatsapp" replace />} />
        <Route path="/flota/chatpool" element={<Navigate to="/flota/whatsapp" replace />} />
        <Route path="/marketing" element={<Navigate to="/marketing/dashboard" replace />} />
        <Route path="/marketing/dashboard" element={<MarketingDashboard />} />
        <Route path="/marketing/leads" element={<MarketingLeads />} />
        <Route path="/marketing/facebook" element={<MarketingFacebook />} />
        <Route path="/marketing/integrations" element={<MarketingIntegrations />} />
        <Route path="/marketing/personal" element={<MarketingPersonal />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute><ModuleGate /></ProtectedRoute>}>
        <Route path="/agentes-ia/workflow/:agentId" element={<AgentesIaWorkflow />} />
        <Route path="/flota/mensajes" element={<FlotaMensajes />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppUpdateBanner />
        <Suspense fallback={<LoadingFallback />}>
          <MainRoutes />
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
