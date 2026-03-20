import type { RBACRole, PermissionKey, PermissionModule } from '@/types';

/** Módulos y acciones para construir la matriz de permisos */
export const PERMISSION_MODULES: { id: PermissionModule; label: string }[] = [
  { id: 'contactos', label: 'Contactos' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'actividades', label: 'Actividades' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'configuracion', label: 'Configuración' },
];

export const PERMISSION_ACTIONS = [
  { id: 'ver', label: 'Ver', tooltip: 'Ver y listar registros' },
  { id: 'crear', label: 'Crear', tooltip: 'Crear nuevos registros' },
  { id: 'editar', label: 'Editar', tooltip: 'Modificar registros existentes' },
  { id: 'eliminar', label: 'Eliminar', tooltip: 'Eliminar registros' },
  { id: 'asignar', label: 'Asignar', tooltip: 'Asignar registros a usuarios' },
] as const;

function allPermissions(): PermissionKey[] {
  const keys: PermissionKey[] = [];
  for (const mod of PERMISSION_MODULES) {
    for (const act of PERMISSION_ACTIONS) {
      keys.push(`${mod.id}.${act.id}` as PermissionKey);
    }
  }
  return keys;
}

function createPermissionSet(
  granted: string[]
): Record<PermissionKey, boolean> {
  const all = allPermissions();
  const set = {} as Record<PermissionKey, boolean>;
  for (const k of all) {
    set[k] = granted.includes(k);
  }
  return set;
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
const ADMIN_PERMISSIONS = allPermissions();
const SUPERVISOR_PERMISSIONS = allPermissions().filter(
  (k) => !k.startsWith('configuracion.') && k !== 'usuarios.crear' && k !== 'usuarios.editar' && k !== 'usuarios.eliminar'
);
const ASESOR_PERMISSIONS = [
  'contactos.ver',
  'contactos.crear',
  'contactos.editar',
  'empresas.ver',
  'empresas.crear',
  'empresas.editar',
  'oportunidades.ver',
  'oportunidades.crear',
  'oportunidades.editar',
  'pipeline.ver',
  'actividades.ver',
  'actividades.crear',
  'actividades.editar',
  'reportes.ver',
];
const SOLO_LECTURA_PERMISSIONS = allPermissions().filter((k) => k.endsWith('.ver'));

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
