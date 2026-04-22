import type {
  RBACRole,
  PermissionKey,
  PermissionModule,
  PermissionAction,
} from '@/types';

/** Módulos y acciones para construir la matriz de permisos */
export const PERMISSION_MODULES: { id: PermissionModule; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'actividades', label: 'Tareas' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'correo', label: 'Correo' },
  { id: 'campanas', label: 'Campañas' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'roles', label: 'Roles' },
  { id: 'auditoria', label: 'Auditoría' },
  { id: 'configuracion', label: 'Configuración' },
  { id: 'agentes_ia', label: 'Agentes IA (copiloto)' },
];

/**
 * Acciones permitidas por módulo (alineado con lo que la app puede hacer).
 * La matriz solo muestra estas casillas; el resto se muestra como N/A.
 */
export const MODULE_ALLOWED_ACTIONS: Record<
  PermissionModule,
  readonly PermissionAction[]
> = {
  dashboard: ['ver', 'exportar'],
  contactos: ['ver', 'crear', 'editar', 'eliminar', 'asignar', 'exportar'],
  empresas: ['ver', 'crear', 'editar', 'eliminar', 'asignar', 'exportar'],
  oportunidades: ['ver', 'crear', 'editar', 'eliminar', 'asignar'],
  pipeline: ['ver', 'editar', 'asignar'],
  actividades: ['ver', 'crear', 'editar', 'eliminar', 'asignar'],
  reportes: ['ver', 'exportar'],
  clientes: ['ver', 'crear', 'editar', 'eliminar', 'asignar', 'exportar'],
  correo: ['ver', 'crear', 'editar', 'eliminar'],
  campanas: ['ver', 'crear', 'editar', 'eliminar', 'exportar'],
  archivos: ['ver', 'crear', 'editar', 'eliminar'],
  equipo: ['ver', 'datos_completos'],
  usuarios: ['ver', 'crear', 'editar', 'eliminar', 'asignar'],
  roles: ['ver', 'crear', 'editar', 'eliminar'],
  auditoria: ['ver'],
  configuracion: ['ver', 'editar'],
  agentes_ia: ['ver', 'editar'],
};

export function moduleAllowsAction(
  moduleId: PermissionModule,
  action: PermissionAction,
): boolean {
  return MODULE_ALLOWED_ACTIONS[moduleId].includes(action);
}

/** Claves que pueden enviarse a la API / guardarse en un rol. */
export function allValidPermissionKeys(): PermissionKey[] {
  const keys: PermissionKey[] = [];
  for (const mod of PERMISSION_MODULES) {
    for (const act of MODULE_ALLOWED_ACTIONS[mod.id]) {
      keys.push(`${mod.id}.${act}` as PermissionKey);
    }
  }
  return keys;
}

export const PERMISSION_ACTIONS = [
  { id: 'ver', label: 'Ver', tooltip: 'Ver y listar registros' },
  { id: 'crear', label: 'Crear', tooltip: 'Crear nuevos registros' },
  { id: 'editar', label: 'Editar', tooltip: 'Modificar registros existentes' },
  { id: 'eliminar', label: 'Eliminar', tooltip: 'Eliminar registros' },
  { id: 'asignar', label: 'Asignar', tooltip: 'Asignar registros a usuarios' },
  {
    id: 'exportar',
    label: 'Exportar',
    tooltip: 'Descargar plantillas, exportar datos o informes',
  },
  {
    id: 'datos_completos',
    label: 'Datos completos del equipo',
    tooltip:
      'Ver y filtrar registros de todos los asesores. Sin esto solo ves tu cartera.',
  },
] as const;

function createPermissionSet(
  granted: string[]
): Record<PermissionKey, boolean> {
  const set = {} as Record<PermissionKey, boolean>;
  for (const mod of PERMISSION_MODULES) {
    for (const act of PERMISSION_ACTIONS) {
      const k = `${mod.id}.${act.id}` as PermissionKey;
      set[k] =
        moduleAllowsAction(mod.id, act.id) && granted.includes(k);
    }
  }
  return set;
}

/** Mapa completo de permisos a partir de la lista que devuelve la API. */
export function buildPermissionRecordFromGrantedList(
  granted: readonly string[],
): Record<PermissionKey, boolean> {
  return createPermissionSet(Array.from(granted));
}

/** Solo claves reconocidas por el modelo actual (por si la BD trae permisos legacy). */
export function sanitizeGrantedPermissionKeys(keys: readonly string[]): string[] {
  const v = new Set<string>(allValidPermissionKeys());
  return keys.filter((k) => v.has(k));
}

/** Templates base para crear roles */
export const ROLE_TEMPLATES = [
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Acceso total al CRM. Puede gestionar usuarios, roles y toda la configuración.',
  },
  {
    id: 'supervisor',
    name: 'Supervisor Comercial',
    description: 'Supervisa el equipo comercial. Ve reportes, asigna contactos y gestiona pipeline.',
  },
  {
    id: 'asesor',
    name: 'Asesor Comercial',
    description: 'Acceso operativo. Gestiona sus contactos, oportunidades y actividades.',
  },
  {
    id: 'solo_lectura',
    name: 'Solo lectura',
    description: 'Solo puede ver datos. No puede crear, editar ni eliminar.',
  },
  {
    id: 'personalizado',
    name: 'Personalizado',
    description: 'Define permisos desde cero o basado en otro rol.',
  },
] as const;

/** Permisos por template */
const ADMIN_PERMISSIONS = allValidPermissionKeys();
const SUPERVISOR_PERMISSIONS = allValidPermissionKeys().filter((k) => {
  if (k.startsWith('configuracion.')) return false;
  if (['usuarios.crear', 'usuarios.editar', 'usuarios.eliminar'].includes(k)) {
    return false;
  }
  if (['roles.crear', 'roles.editar', 'roles.eliminar'].includes(k)) {
    return false;
  }
  return true;
});
const ASESOR_PERMISSIONS = [
  'dashboard.ver',
  'dashboard.exportar',
  'contactos.ver',
  'contactos.crear',
  'contactos.editar',
  'contactos.exportar',
  'empresas.ver',
  'empresas.crear',
  'empresas.editar',
  'empresas.exportar',
  'oportunidades.ver',
  'oportunidades.crear',
  'oportunidades.editar',
  'pipeline.ver',
  'actividades.ver',
  'actividades.crear',
  'actividades.editar',
  'reportes.ver',
  'clientes.ver',
  'clientes.exportar',
  'correo.ver',
  'campanas.ver',
  'campanas.exportar',
  'archivos.ver',
  'equipo.ver',
  'usuarios.ver',
  'agentes_ia.ver',
  'agentes_ia.editar',
];
const SOLO_LECTURA_PERMISSIONS = [
  ...allValidPermissionKeys().filter((k) => k.endsWith('.ver')),
  'equipo.datos_completos',
];

export const INITIAL_ROLES: RBACRole[] = [
  {
    id: 'r1',
    name: 'Administrador',
    description: 'Acceso total al CRM',
    templateId: 'admin',
    permissions: createPermissionSet(ADMIN_PERMISSIONS),
    userCount: 1,
  },
  {
    id: 'r2',
    name: 'Supervisor Comercial',
    description: 'Supervisa equipo y reportes',
    templateId: 'supervisor',
    permissions: createPermissionSet(SUPERVISOR_PERMISSIONS),
    userCount: 1,
  },
  {
    id: 'r3',
    name: 'Asesor Comercial',
    description: 'Gestiona contactos y oportunidades',
    templateId: 'asesor',
    permissions: createPermissionSet(ASESOR_PERMISSIONS),
    userCount: 4,
  },
  {
    id: 'r4',
    name: 'Solo lectura',
    description: 'Solo visualización de datos',
    templateId: 'solo_lectura',
    permissions: createPermissionSet(SOLO_LECTURA_PERMISSIONS),
    userCount: 0,
  },
];

/** Convierte el rol guardado en User (API/store) al templateId de RBAC. */
export function roleStringToTemplateId(role: string): string {
  const r = role.trim().toLowerCase().replace(/\s+/g, ' ');
  if (r === 'admin' || r === 'administrador') return 'admin';
  if (
    r === 'solo_lectura' ||
    r === 'solo lectura' ||
    r === 'sololectura' ||
    r === 'lectura'
  ) {
    return 'solo_lectura';
  }
  if (r === 'asesor' || r.startsWith('asesor ')) return 'asesor';
  if (
    r === 'supervisor' ||
    r === 'gerente' ||
    r.includes('gerente') ||
    r.includes('jefe comercial') ||
    r.includes('jefe_comercial') ||
    r.includes('jefe de comercial')
  ) {
    return 'supervisor';
  }
  return 'asesor';
}

/** Admin, jefe comercial, gerente, supervisor: pueden reasignar asesor en CRM. */
export function canReassignCommercialAdvisor(roleLabel: string): boolean {
  const t = roleStringToTemplateId(roleLabel);
  return t === 'admin' || t === 'supervisor';
}

export function getTemplatePermissions(templateId: string): Record<PermissionKey, boolean> {
  switch (templateId) {
    case 'admin':
      return createPermissionSet(ADMIN_PERMISSIONS);
    case 'supervisor':
      return createPermissionSet(SUPERVISOR_PERMISSIONS);
    case 'asesor':
      return createPermissionSet(ASESOR_PERMISSIONS);
    case 'solo_lectura':
      return createPermissionSet(SOLO_LECTURA_PERMISSIONS);
    case 'personalizado':
    default:
      return createPermissionSet([]);
  }
}
