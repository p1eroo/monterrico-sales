import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';

export function AreaGate() {
  const location = useLocation();
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin = currentUser.role === 'admin';
  const allowedAreas = currentUser.allowedAreas || [];

  const path = location.pathname;

  // Si es admin, puede pasar a cualquier lado
  if (isAdmin) {
    return <Outlet />;
  }

  // Rutas de Flota
  if (path.startsWith('/flota')) {
    if (!allowedAreas.includes('flota')) {
      return <Navigate to="/area-select" replace />;
    }
  }

  // Rutas Comerciales (todas las que no son flota o admin)
  // Nota: Consideramos que si no tiene "comercial" y trata de entrar a rutas base, debe ser bloqueado
  const isCommercialPath = !path.startsWith('/flota') && !path.startsWith('/admin') && !path.startsWith('/area-select') && !path.startsWith('/login') && !path.startsWith('/profile');
  
  if (isCommercialPath) {
    if (!allowedAreas.includes('comercial')) {
      return <Navigate to="/area-select" replace />;
    }
  }

  return <Outlet />;
}
