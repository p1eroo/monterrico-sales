/**
 * Contexto para el asistente: módulo actual y entidad en detalle (si aplica).
 */
export function buildAssistantContext(
  pathname: string,
  user: { id: string; role: string },
): {
  userId: string;
  currentPage: string;
  userRole: string;
  selectedEntityType?: string;
  selectedEntityId?: string;
} {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0] ?? 'dashboard';

  const pageMap: Record<string, string> = {
    dashboard: 'dashboard',
    contactos: 'contacts',
    empresas: 'companies',
    pipeline: 'pipeline',
    tareas: 'tasks',
    calendario: 'calendar',
    inbox: 'inbox',
    campaigns: 'campaigns',
    opportunities: 'opportunities',
    clients: 'clients',
    reports: 'reports',
    team: 'team',
    users: 'users',
    audit: 'audit',
    profile: 'profile',
    settings: 'settings',
    archivos: 'files',
  };

  const currentPage = pageMap[first] ?? first;

  let selectedEntityType: string | undefined;
  let selectedEntityId: string | undefined;
  if (segments.length >= 2 && segments[1] && segments[1] !== 'new') {
    selectedEntityId = segments[1];
    if (first === 'contactos') selectedEntityType = 'contact';
    if (first === 'empresas') selectedEntityType = 'company';
    if (first === 'opportunities') selectedEntityType = 'opportunity';
    if (first === 'users') selectedEntityType = 'user';
  }

  return {
    userId: user.id,
    currentPage,
    userRole: user.role,
    ...(selectedEntityType && selectedEntityId
      ? { selectedEntityType, selectedEntityId }
      : {}),
  };
}
