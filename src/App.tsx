import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAppStore } from '@/store';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const MainLayout = lazy(() => import('@/components/layout/MainLayout'));
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Contactos = lazy(() => import('@/pages/Contactos'));
const LeadDetail = lazy(() => import('@/pages/LeadDetail'));
const Empresas = lazy(() => import('@/pages/Empresas'));
const EmpresaDetail = lazy(() => import('@/pages/EmpresaDetail'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));

function RedirectLeadToContact() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/contactos/${id}` : '/contactos'} replace />;
}
const Activities = lazy(() => import('@/pages/Activities'));
const Opportunities = lazy(() => import('@/pages/Opportunities'));
const Clients = lazy(() => import('@/pages/Clients'));
const Reports = lazy(() => import('@/pages/Reports'));
const Team = lazy(() => import('@/pages/Team'));
const Settings = lazy(() => import('@/pages/Settings'));

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
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/leads" element={<Navigate to="/contactos" replace />} />
              <Route path="/leads/:id" element={<RedirectLeadToContact />} />
              <Route path="/contactos" element={<Contactos />} />
              <Route path="/contactos/:id" element={<LeadDetail />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/empresas/:id" element={<EmpresaDetail />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/activities" element={<Activities />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
