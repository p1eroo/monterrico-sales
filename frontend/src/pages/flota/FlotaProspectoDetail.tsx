import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  FileArchive,
  ChevronLeft,
  MoreVertical,
  Edit,
  Globe,
  CalendarDays,
  Car,
  ClipboardList,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { WhatsappContactDrawer } from '@/components/shared/WhatsappContactDrawer';
import { formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PROSPECTO_MOCK = {
  id: '1',
  nombres: 'Juan',
  apellidos: 'Pérez López',
  dni: '12345678',
  telefono: '+51 999 111 222',
  email: 'juan@example.com',
  estado: 'Nuevo',
  fuente: 'Web',
  zona: 'Lima Centro',
  fechaNacimiento: '1985-03-15',
  tieneVehiculo: true,
  tipoVehiculo: 'Sedan',
  placa: 'ABC-123',
  experienciaAnios: 3,
  observaciones: 'Interesado en trabajar en la zona de Lima Centro. Tiene vehículo propio marca Toyota.',
  createdAt: '2026-05-05T10:00:00Z',
  updatedAt: '2026-05-05T10:00:00Z',
};

type ProspectoForWhatsApp = {
  id: string;
  name: string;
  telefono: string;
  urlSlug?: string;
};

const TIMELINE_MOCK = [
  {
    id: '1',
    type: 'crear',
    title: 'Prospecto creado',
    description: 'El prospecto fue registrado a través del formulario web.',
    timestamp: '2026-05-05T10:00:00Z',
    userName: 'Sistema',
  },
  {
    id: '2',
    type: 'whatsapp',
    title: 'Mensaje de WhatsApp enviado',
    description: 'Se envió el primer mensaje de bienvenida.',
    timestamp: '2026-05-05T10:30:00Z',
    userName: 'Carlos Mendoza',
  },
];

const estadoColors: Record<string, string> = {
  Nuevo: 'bg-blue-100 text-blue-700 border-blue-200',
  Contactado: 'bg-amber-100 text-amber-700 border-amber-200',
  Conversión: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  NoInteresado: 'bg-red-100 text-red-700 border-red-200',
};

function ProspectoInformacionAside({ prospecto }: { prospecto: typeof PROSPECTO_MOCK }) {
  return (
    <EntityInfoCard
      title="INFORMACIÓN"
      collapsible
      fields={[
        { icon: User, value: `${prospecto.nombres} ${prospecto.apellidos}` },
        { icon: Phone, value: prospecto.telefono, href: `tel:${prospecto.telefono}` },
        { icon: Mail, value: prospecto.email, href: `mailto:${prospecto.email}` },
        { icon: Globe, value: prospecto.fuente },
        { icon: MapPin, value: prospecto.zona },
        { icon: CalendarDays, value: `Creado: ${formatDate(prospecto.createdAt)}` },
        { icon: Car, value: prospecto.tieneVehiculo ? `Vehículo: ${prospecto.tipoVehiculo || 'Sí'}` : 'Sin vehículo propio' },
        ...(prospecto.placa ? [{ icon: ClipboardList, value: `Placa: ${prospecto.placa}` }] : []),
        { icon: Calendar, value: `${prospecto.experienciaAnios} años de experiencia` },
      ]}
    />
  );
}

function ProspectoArchivosAside() {
  return (
    <EntityInfoCard
      title="ARCHIVOS"
      collapsible
      fields={[]}
      extraContent={
        <div className="py-4 text-center">
          <FileArchive className="mx-auto mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin archivos adjuntos</p>
          <Button variant="link" size="sm" className="mt-1 h-auto p-0">
            Subir archivos
          </Button>
        </div>
      }
    />
  );
}

export default function FlotaProspectoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('historial');
  const [whatsappDrawerOpen, setWhatsappDrawerOpen] = useState(false);
  const prospecto = PROSPECTO_MOCK;

  const prospectoForWhatsApp: ProspectoForWhatsApp = {
    id: prospecto.id,
    name: `${prospecto.nombres} ${prospecto.apellidos}`,
    telefono: prospecto.telefono,
  };

  if (!prospecto) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Prospecto no encontrado</p>
      </div>
    );
  }

  const handleQuickActivityCreated = (draft: any) => {
    toast.success(`Actividad "${draft.title}" creada (Mock)`);
  };

  const handleTaskCreated = (task: any) => {
    toast.success(`Tarea "${task.title}" creada (Mock)`);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <QuickActionsWithDialogs
        entityName={`${prospecto.nombres} ${prospecto.apellidos}`}
        onActivityCreated={handleQuickActivityCreated}
        onTaskCreated={handleTaskCreated}
        inline
      />
      <Button 
        className="gap-1.5 bg-whatsapp px-3 text-whatsapp-foreground hover:bg-whatsapp/90 h-9"
        onClick={() => setWhatsappDrawerOpen(true)}
      >
        <MessageSquare className="size-4" />
        WhatsApp
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-lg text-text-secondary hover:bg-accent hover:text-accent-foreground"
        onClick={() => toast.info('Editando prospecto...')}
      >
        <Edit className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="text-destructive focus:text-destructive">
            Eliminar Prospecto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <DetailLayout
      backPath="/flota/prospectos"
      title={`${prospecto.nombres} ${prospecto.apellidos}`}
      subtitle={`DNI: ${prospecto.dni}`}
      headerActions={headerActions}
      leftAside={<ProspectoInformacionAside prospecto={prospecto} />}
      sidebar={<ProspectoArchivosAside />}
    >
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6 flex items-center justify-between">
            <TabsList className="bg-surface-elevated p-1 border border-border/50">
              <TabsTrigger value="historial" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Historial</TabsTrigger>
              <TabsTrigger value="actividades" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Actividades</TabsTrigger>
              <TabsTrigger value="tareas" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Tareas</TabsTrigger>
              <TabsTrigger value="notas" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Notas</TabsTrigger>
              <TabsTrigger value="archivos" className="px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Archivos</TabsTrigger>
            </TabsList>
            
            <Badge variant="outline" className={cn("px-3 py-1 text-xs font-medium", estadoColors[prospecto.estado])}>
              {prospecto.estado}
            </Badge>
          </div>

          <TabsContent value="historial" className="mt-0 focus-visible:outline-none">
            <TimelinePanel
              events={TIMELINE_MOCK.map(e => ({
                id: e.id,
                type: e.type as any,
                title: e.title,
                description: e.description,
                date: e.timestamp,
                user: e.userName,
              }))}
            />
          </TabsContent>

          <TabsContent value="actividades" className="mt-0">
            <Card className="border-border/50 bg-surface-elevated/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="mb-4 size-12 text-muted-foreground/20" />
                <h3 className="text-lg font-medium">Sin actividades programadas</h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  No hay llamadas o reuniones próximas registradas para este prospecto.
                </p>
                <Button className="mt-4" variant="outline">Programar actividad</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tareas" className="mt-0">
            <Card className="border-border/50 bg-surface-elevated/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="mb-4 size-12 text-muted-foreground/20" />
                <h3 className="text-lg font-medium">Sin tareas pendientes</h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Todas las tareas para este prospecto han sido completadas.
                </p>
                <Button className="mt-4" variant="outline">Añadir tarea</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notas" className="mt-0">
            <Card className="border-border/50 bg-surface-elevated/50">
              <CardContent className="py-6">
                <div className="mb-4 rounded-lg bg-background p-4 border border-border/50">
                  <p className="text-sm italic text-muted-foreground">"{prospecto.observaciones}"</p>
                  <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Nota inicial de registro</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(prospecto.createdAt)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full">Agregar nueva nota</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="archivos" className="mt-0">
            <Card className="border-border/50 bg-surface-elevated/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileArchive className="mb-4 size-12 text-muted-foreground/20" />
                <h3 className="text-lg font-medium">Gestiona los documentos aquí</h3>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Sube DNI, licencia de conducir u otros documentos necesarios para el proceso.
                </p>
                <Button className="mt-4" variant="outline">Subir archivos</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <WhatsappContactDrawer
        contact={prospectoForWhatsApp as any}
        open={whatsappDrawerOpen}
        onOpenChange={setWhatsappDrawerOpen}
      />
    </DetailLayout>
  );
}