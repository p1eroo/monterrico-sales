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

  // Rutas de Marketing
  if (path.startsWith('/marketing')) {
    if (!allowedAreas.includes('marketing')) {
      return <Navigate to="/area-select" replace />;
    }
  }

  // Rutas Comerciales (todas las que no son flota, marketing o admin)
  const isCommercialPath = !path.startsWith('/flota') && !path.startsWith('/marketing') && !path.startsWith('/admin') && !path.startsWith('/area-select') && !path.startsWith('/login') && !path.startsWith('/profile') && !path.startsWith('/dev');
  
  if (isCommercialPath) {
    if (!allowedAreas.includes('comercial')) {
      return <Navigate to="/area-select" replace />;
    }
  }

  return <Outlet />;
}
