import { Navigate, Outlet } from 'react-router-dom';

export default function FlotaIntegracionesLayout() {
  return <Outlet />;
}

export function FlotaIntegracionesIndex() {
  return <Navigate to="/flota/integraciones/evolution" replace />;
}
