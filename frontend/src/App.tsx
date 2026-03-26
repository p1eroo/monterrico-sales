import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAppStore } from '@/store';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ModuleGate } from '@/components/layout/ModuleGate';

const MainLayout = lazy(() => import('@/components/layout/MainLayout'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Contactos = lazy(() => import('@/pages/Contactos'));
const ContactoDetail = lazy(() => import('@/pages/ContactoDetail'));
const Empresas = lazy(() => import('@/pages/Empresas'));
const EmpresaDetail = lazy(() => import('@/pages/EmpresaDetail'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));

const Tareas = lazy(() => import('@/pages/Tareas'));
const Calendario = lazy(() => import('@/pages/Calendario'));
const Opportunities = lazy(() => import('@/pages/Opportunities'));
const OportunidadDetail = lazy(() => import('@/pages/OportunidadDetail'));
const Clients = lazy(() => import('@/pages/Clients'));
const Reports = lazy(() => import('@/pages/Reports'));
const Team = lazy(() => import('@/pages/Team'));
const Users = lazy(() => import('@/pages/Users'));
const UserDetail = lazy(() => import('@/pages/UserDetail'));
const Audit = lazy(() => import('@/pages/Audit'));
const Inbox = lazy(() => import('@/pages/Inbox'));
const CampaignHistory = lazy(() => import('@/pages/CampaignHistory'));
const CampaignBuilder = lazy(() => import('@/pages/CampaignBuilder'));
const CampaignResults = lazy(() => import('@/pages/CampaignResults'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const Files = lazy(() => import('@/pages/Files'));
const AgentesIa = lazy(() => import('@/pages/AgentesIa'));
const AgentesIaWorkflow = lazy(() => import('@/pages/AgentesIaWorkflow'));

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
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
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
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/contactos" element={<Contactos />} />
              <Route path="/contactos/:id" element={<ContactoDetail />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/empresas/:id" element={<EmpresaDetail />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/tareas" element={<Tareas />} />
              <Route path="/calendario" element={<Calendario />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/opportunities/:id" element={<OportunidadDetail />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/team" element={<Team />} />
              <Route path="/users" element={<Users />} />
              <Route path="/users/:id" element={<UserDetail />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/campaigns" element={<CampaignHistory />} />
              <Route path="/campaigns/new" element={<CampaignBuilder />} />
              <Route path="/campaigns/:id/results" element={<CampaignResults />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/archivos" element={<Files />} />
              <Route path="/agentes-ia" element={<AgentesIa />} />
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <ModuleGate />
                </ProtectedRoute>
              }
            >
              <Route
                path="/agentes-ia/workflow/:agentId"
                element={<AgentesIaWorkflow />}
              />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
