import { useState } from 'react';
import {
  Building2, Globe, GitBranch, Shield, Flag,
  Activity, Tag, Settings as SettingsIcon,
  Plus, Trash2, GripVertical, Phone, Mail,
  MapPin, Save, Video, FileText, RefreshCw,
  MessageCircle, Bell, Moon,
} from 'lucide-react';
import type { UserRole } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardHeader,
  CardTitle, CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const NAV_SECTIONS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'fuentes', label: 'Fuentes de Contactos', icon: Globe },
  { id: 'pipeline', label: 'Etapas del Pipeline', icon: GitBranch },
  { id: 'roles', label: 'Roles y Permisos', icon: Shield },
  { id: 'prioridades', label: 'Prioridades', icon: Flag },
  { id: 'actividades', label: 'Tipos de Actividad', icon: Activity },
  { id: 'estados', label: 'Etapas (Contactos/Empresas/Oportunidades)', icon: Tag },
  { id: 'preferencias', label: 'Preferencias', icon: SettingsIcon },
] as const;

const INITIAL_LEAD_SOURCES = [
  { id: 'referido', name: 'Referido', enabled: true },
  { id: 'base', name: 'Base', enabled: true },
  { id: 'entorno', name: 'Entorno', enabled: true },
  { id: 'feria', name: 'Feria', enabled: true },
  { id: 'masivo', name: 'Masivo', enabled: true },
];

const INITIAL_PIPELINE_STAGES = [
  { id: 'lead', name: 'Lead', color: '#64748b', enabled: true },
  { id: 'contacto', name: 'Contacto', color: '#3b82f6', enabled: true },
  { id: 'reunion_agendada', name: 'Reunión Agendada', color: '#6366f1', enabled: true },
  { id: 'reunion_efectiva', name: 'Reunión Efectiva', color: '#06b6d4', enabled: true },
  { id: 'propuesta_economica', name: 'Propuesta Económica', color: '#8b5cf6', enabled: true },
  { id: 'negociacion', name: 'Negociación', color: '#f97316', enabled: true },
  { id: 'licitacion', name: 'Licitación', color: '#f59e0b', enabled: true },
  { id: 'licitacion_etapa_final', name: 'Licitación Etapa Final', color: '#eab308', enabled: true },
  { id: 'cierre_ganado', name: 'Cierre Ganado', color: '#22c55e', enabled: true },
  { id: 'firma_contrato', name: 'Firma de Contrato', color: '#16a34a', enabled: true },
  { id: 'activo', name: 'Activo', color: '#15803d', enabled: true },
  { id: 'cierre_perdido', name: 'Cierre Perdido', color: '#ef4444', enabled: true },
  { id: 'inactivo', name: 'Inactivo', color: '#6b7280', enabled: true },
];

const PERMISSION_KEYS = [
  'Ver leads',
  'Crear leads',
  'Editar leads',
  'Eliminar leads',
  'Ver reportes',
  'Gestionar equipo',
  'Configuración',
] as const;

type SettingsRole = UserRole | 'jefe_comercial';

const INITIAL_PERMISSIONS: Record<SettingsRole, Record<string, boolean>> = {
  admin: {
    'Ver leads': true, 'Crear leads': true, 'Editar leads': true,
    'Eliminar leads': true, 'Ver reportes': true, 'Gestionar equipo': true,
    'Configuración': true,
  },
  gerente: {
    'Ver leads': true, 'Crear leads': true, 'Editar leads': true,
    'Eliminar leads': false, 'Ver reportes': true, 'Gestionar equipo': true,
    'Configuración': false,
  },
  jefe_comercial: {
    'Ver leads': true, 'Crear leads': true, 'Editar leads': true,
    'Eliminar leads': false, 'Ver reportes': true, 'Gestionar equipo': true,
    'Configuración': false,
  },
  asesor: {
    'Ver leads': true, 'Crear leads': true, 'Editar leads': true,
    'Eliminar leads': false, 'Ver reportes': false, 'Gestionar equipo': false,
    'Configuración': false,
  },
};

const PRIORITIES = [
  { id: 'alta', name: 'Alta', color: '#ef4444', description: 'Atención inmediata requerida' },
  { id: 'media', name: 'Media', color: '#f59e0b', description: 'Seguimiento regular programado' },
  { id: 'baja', name: 'Baja', color: '#3b82f6', description: 'Sin urgencia, atender cuando sea posible' },
];

const ACTIVITY_TYPE_ICONS: Record<string, typeof Phone> = {
  llamada: Phone,
  reunion: Video,
  tarea: FileText,
  correo: Mail,
  seguimiento: RefreshCw,
  whatsapp: MessageCircle,
};

const INITIAL_ACTIVITY_TYPES = [
  { id: 'llamada', name: 'Llamada', enabled: true },
  { id: 'reunion', name: 'Reunión', enabled: true },
  { id: 'tarea', name: 'Tarea', enabled: true },
  { id: 'correo', name: 'Correo', enabled: true },
  { id: 'seguimiento', name: 'Seguimiento', enabled: true },
  { id: 'whatsapp', name: 'WhatsApp', enabled: true },
];

const ETAPAS_CONFIG = [
  { id: 'lead', name: 'Lead', color: '#64748b', order: 1, prob: 0 },
  { id: 'contacto', name: 'Contacto', color: '#3b82f6', order: 2, prob: 10 },
  { id: 'reunion_agendada', name: 'Reunión Agendada', color: '#6366f1', order: 3, prob: 30 },
  { id: 'reunion_efectiva', name: 'Reunión Efectiva', color: '#06b6d4', order: 4, prob: 40 },
  { id: 'propuesta_economica', name: 'Propuesta Económica', color: '#8b5cf6', order: 5, prob: 50 },
  { id: 'negociacion', name: 'Negociación', color: '#f97316', order: 6, prob: 70 },
  { id: 'licitacion', name: 'Licitación', color: '#f59e0b', order: 7, prob: 75 },
  { id: 'licitacion_etapa_final', name: 'Licitación Etapa Final', color: '#eab308', order: 8, prob: 85 },
  { id: 'cierre_ganado', name: 'Cierre Ganado', color: '#22c55e', order: 9, prob: 90 },
  { id: 'firma_contrato', name: 'Firma de Contrato', color: '#16a34a', order: 10, prob: 95 },
  { id: 'activo', name: 'Activo', color: '#15803d', order: 11, prob: 100 },
  { id: 'cierre_perdido', name: 'Cierre Perdido', color: '#ef4444', order: 12, prob: -1 },
  { id: 'inactivo', name: 'Inactivo', color: '#6b7280', order: 13, prob: -5 },
];

const ROLE_LABELS: Record<SettingsRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente Comercial',
  jefe_comercial: 'Jefe Comercial',
  asesor: 'Asesor',
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [leadSources, setLeadSources] = useState(INITIAL_LEAD_SOURCES);
  const [newSourceName, setNewSourceName] = useState('');
  const [pipelineStages, setPipelineStages] = useState(INITIAL_PIPELINE_STAGES);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#64748b');
  const [rolePermissions, setRolePermissions] = useState(INITIAL_PERMISSIONS);
  const [activityTypes, setActivityTypes] = useState(INITIAL_ACTIVITY_TYPES);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  function addLeadSource() {
    const trimmed = newSourceName.trim();
    if (!trimmed) return;
    setLeadSources((prev) => [
      ...prev,
      { id: trimmed.toLowerCase().replace(/\s+/g, '_'), name: trimmed, enabled: true },
    ]);
    setNewSourceName('');
  }

  function removeLeadSource(id: string) {
    setLeadSources((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleLeadSource(id: string) {
    setLeadSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  function togglePipelineStage(id: string) {
    setPipelineStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  function addPipelineStage() {
    const trimmed = newStageName.trim();
    if (!trimmed) return;
    const baseId = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const existingIds = new Set(pipelineStages.map((s) => s.id));
    let id = baseId || 'etapa';
    let n = 1;
    while (existingIds.has(id)) {
      id = `${baseId}_${n}`;
      n++;
    }
    setPipelineStages((prev) => [
      ...prev,
      { id, name: trimmed, color: newStageColor, enabled: true },
    ]);
    setNewStageName('');
    setNewStageColor('#64748b');
    setAddStageOpen(false);
  }

  function removePipelineStage(id: string) {
    setPipelineStages((prev) => prev.filter((s) => s.id !== id));
  }

  function handlePermissionChange(role: SettingsRole, permission: string, checked: boolean) {
    setRolePermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [permission]: checked },
    }));
  }

  function toggleActivityType(id: string) {
    setActivityTypes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Administra la configuración del CRM"
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Navigation */}
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:pb-0">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap transition-colors text-left',
                  activeTab === section.id
                    ? 'bg-[#13944C]/10 text-[#13944C] font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="min-w-0 flex-1">
          {/* General */}
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
                <CardDescription>Datos de la empresa y configuración básica</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-name">Nombre de la empresa</Label>
                    <Input id="company-name" defaultValue="Taxi Monterrico" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company-desc">Descripción</Label>
                    <Textarea
                      id="company-desc"
                      rows={3}
                      defaultValue="Servicio de transporte ejecutivo corporativo en Lima, Perú. Ofrecemos soluciones de movilidad premium para empresas, hoteles, embajadas y organizaciones."
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="flex items-center gap-1.5">
                      <Mail className="size-3.5" /> Email de contacto
                    </Label>
                    <Input id="contact-email" defaultValue="info@taximonterrico.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone" className="flex items-center gap-1.5">
                      <Phone className="size-3.5" /> Teléfono
                    </Label>
                    <Input id="contact-phone" defaultValue="+51 1 234 5678" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="address" className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> Dirección
                    </Label>
                    <Input
                      id="address"
                      defaultValue="Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Logo de la empresa</Label>
                  <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-8">
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-lg bg-[#13944C]/10">
                        <Building2 className="size-6 text-[#13944C]" />
                      </div>
                      <p className="text-sm font-medium">Arrastra o haz clic para subir</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG hasta 2MB</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-[#13944C] text-white hover:bg-[#0f7a3d]">
                    <Save className="size-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fuentes de Contactos */}
          {activeTab === 'fuentes' && (
            <Card>
              <CardHeader>
                <CardTitle>Fuentes de Contactos</CardTitle>
                <CardDescription>
                  Configura las fuentes de captación de leads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nueva fuente de leads..."
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLeadSource()}
                  />
                  <Button
                    onClick={addLeadSource}
                    className="shrink-0 bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                  >
                    <Plus className="size-4" />
                    Agregar
                  </Button>
                </div>

                <div className="space-y-2">
                  {leadSources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <span
                        className={cn(
                          'text-sm font-medium',
                          !source.enabled && 'text-muted-foreground line-through',
                        )}
                      >
                        {source.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={source.enabled}
                          onCheckedChange={() => toggleLeadSource(source.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => removeLeadSource(source.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Etapas del Pipeline */}
          {activeTab === 'pipeline' && (
            <Card>
              <CardHeader>
                <CardTitle>Etapas del Pipeline</CardTitle>
                <CardDescription>
                  Ordena y configura las etapas del embudo de ventas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex justify-end">
                  <Button
                    onClick={() => setAddStageOpen(true)}
                    className="bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                  >
                    <Plus className="size-4" />
                    Añadir etapa
                  </Button>
                </div>
                <div className="space-y-2">
                  {pipelineStages.map((stage) => {
                    const isDefault = INITIAL_PIPELINE_STAGES.some((s) => s.id === stage.id);
                    return (
                      <div
                        key={stage.id}
                        className="flex items-center gap-3 rounded-lg border px-4 py-3"
                      >
                        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                        <div
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span
                          className={cn(
                            'flex-1 text-sm font-medium',
                            !stage.enabled && 'text-muted-foreground line-through',
                          )}
                        >
                          {stage.name}
                        </span>
                        <Switch
                          checked={stage.enabled}
                          onCheckedChange={() => togglePipelineStage(stage.id)}
                        />
                        {!isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-red-600"
                            onClick={() => removePipelineStage(stage.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Arrastra los elementos para reordenar las etapas del pipeline.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Modal Añadir etapa */}
          <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir etapa</DialogTitle>
                <DialogDescription>
                  Crea una nueva etapa para el pipeline del equipo. La lógica se sincronizará con el backend al implementarlo.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="stage-name">Nombre de la etapa</Label>
                  <Input
                    id="stage-name"
                    placeholder="Ej: Cotización enviada"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPipelineStage()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage-color">Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="stage-color"
                      type="color"
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-input"
                    />
                    <Input
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddStageOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={addPipelineStage}
                  disabled={!newStageName.trim()}
                  className="bg-[#13944C] text-white hover:bg-[#0f7a3d]"
                >
                  <Plus className="size-4" />
                  Añadir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Roles y Permisos */}
          {activeTab === 'roles' && (
            <Card>
              <CardHeader>
                <CardTitle>Roles y Permisos</CardTitle>
                <CardDescription>
                  Define qué puede hacer cada rol dentro del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Permiso</TableHead>
                      {(['admin', 'gerente', 'jefe_comercial', 'asesor'] as const).map((role) => (
                        <TableHead key={role} className="text-center">
                          {ROLE_LABELS[role]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSION_KEYS.map((perm) => (
                      <TableRow key={perm}>
                        <TableCell className="font-medium">{perm}</TableCell>
                        {(['admin', 'gerente', 'jefe_comercial', 'asesor'] as const).map((role) => (
                          <TableCell key={role} className="text-center">
                            <Checkbox
                              checked={rolePermissions[role][perm]}
                              onCheckedChange={(checked) =>
                                handlePermissionChange(role, perm, !!checked)
                              }
                              disabled={role === 'admin'}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-xs text-muted-foreground">
                  Los permisos del administrador no pueden ser modificados.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Prioridades */}
          {activeTab === 'prioridades' && (
            <Card>
              <CardHeader>
                <CardTitle>Niveles de Prioridad</CardTitle>
                <CardDescription>
                  Configuración de los niveles de prioridad para leads y oportunidades
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {PRIORITIES.map((priority) => (
                    <div
                      key={priority.id}
                      className="flex items-center gap-4 rounded-lg border p-4"
                    >
                      <div
                        className="size-4 shrink-0 rounded-full"
                        style={{ backgroundColor: priority.color }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{priority.name}</p>
                        <p className="text-xs text-muted-foreground">{priority.description}</p>
                      </div>
                      <div
                        className="rounded-md px-3 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `${priority.color}15`,
                          color: priority.color,
                        }}
                      >
                        {priority.name}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tipos de Actividad */}
          {activeTab === 'actividades' && (
            <Card>
              <CardHeader>
                <CardTitle>Tipos de Actividad</CardTitle>
                <CardDescription>
                  Gestiona los tipos de actividades disponibles en el CRM
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activityTypes.map((at) => {
                    const Icon = ACTIVITY_TYPE_ICONS[at.id];
                    return (
                      <div
                        key={at.id}
                        className="flex items-center gap-3 rounded-lg border px-4 py-3"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {Icon && <Icon className="size-4" />}
                        </div>
                        <span
                          className={cn(
                            'flex-1 text-sm font-medium',
                            !at.enabled && 'text-muted-foreground line-through',
                          )}
                        >
                          {at.name}
                        </span>
                        <Switch
                          checked={at.enabled}
                          onCheckedChange={() => toggleActivityType(at.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Etapas (Contactos, Empresas, Oportunidades) */}
          {activeTab === 'estados' && (
            <Card>
              <CardHeader>
                <CardTitle>Etapas</CardTitle>
                <CardDescription>
                  Etapas unificadas para contactos, empresas y oportunidades. El porcentaje define la probabilidad en oportunidades.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ETAPAS_CONFIG.map((etapa) => (
                    <div
                      key={etapa.id}
                      className="flex items-center gap-3 rounded-lg border px-4 py-3"
                    >
                      <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                        {etapa.order}
                      </span>
                      <div
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: etapa.color }}
                      />
                      <span className="flex-1 text-sm font-medium">{etapa.name}</span>
                      <span
                        className="rounded-md px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `${etapa.color}15`,
                          color: etapa.color,
                        }}
                      >
                        {etapa.name} ({etapa.prob}%)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preferencias */}
          {activeTab === 'preferencias' && (
            <Card>
              <CardHeader>
                <CardTitle>Preferencias</CardTitle>
                <CardDescription>
                  Personaliza tu experiencia en el CRM
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Notificaciones</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Mail className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Notificaciones por email</p>
                          <p className="text-xs text-muted-foreground">
                            Recibir alertas y resúmenes por correo electrónico
                          </p>
                        </div>
                      </div>
                      <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                          <Bell className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Notificaciones push</p>
                          <p className="text-xs text-muted-foreground">
                            Recibir notificaciones en tiempo real en el navegador
                          </p>
                        </div>
                      </div>
                      <Switch checked={pushNotif} onCheckedChange={setPushNotif} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Apariencia</h4>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Moon className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Modo oscuro</p>
                        <p className="text-xs text-muted-foreground">
                          Cambiar el tema de la interfaz
                        </p>
                      </div>
                    </div>
                    <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Regional</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <Select defaultValue="es">
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="pt">Português</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Zona horaria</Label>
                      <Select defaultValue="america_lima">
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="america_lima">America/Lima (UTC-5)</SelectItem>
                          <SelectItem value="america_bogota">America/Bogota (UTC-5)</SelectItem>
                          <SelectItem value="america_mexico">America/Mexico City (UTC-6)</SelectItem>
                          <SelectItem value="america_santiago">America/Santiago (UTC-3)</SelectItem>
                          <SelectItem value="america_buenos_aires">America/Buenos Aires (UTC-3)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button className="bg-[#13944C] text-white hover:bg-[#0f7a3d]">
                    <Save className="size-4" />
                    Guardar Preferencias
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
