import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Phone,
  MapPin,
  Calendar,
  User,
  FileArchive,
  MoreVertical,
  Edit,
  Globe,
  CalendarDays,
  Car,
  ClipboardList,
  MessageSquare,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  Ban,
  Upload,
  Eye,
  X,
  Video,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DetailLayout } from '@/components/shared/DetailLayout';
import { EntityInfoCard } from '@/components/shared/EntityInfoCard';
import { TimelinePanel } from '@/components/shared/TimelinePanel';
import { formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { QuickActionsWithDialogs } from '@/components/shared/QuickActionsWithDialogs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { flotaProspectoDetail, flotaProspectoUpdate, flotaProspectoFiles, flotaProspectoFileContentUrl, flotaProspectoUploadFile, flotaLlamadasList, flotaLlamadaCreate, fetchOperadores, getOperatorDisplayName, type FlotaProspectoRow, type FlotaLlamada, type FlotaFile, type OperadorUser } from '@/lib/flotaProspectosApi';

const ESTADOS = ['Afiliado', 'Citado', 'Seguimiento', 'Informacion', 'Sin Requisitos', 'No Responde'] as const;

const TIMELINE_MOCK = [
  {
    id: '1',
    type: 'crear',
    title: 'Prospecto creado',
    description: 'El prospecto fue registrado en el sistema.',
    timestamp: new Date().toISOString(),
    userName: 'Sistema',
  },
];

const estadoColors: Record<string, string> = {
  Afiliado: 'shadow-none bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200',
  Citado: 'shadow-none bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200',
  Seguimiento: 'shadow-none bg-green-100 text-green-700 border-green-300 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/60',
  Informacion: 'shadow-none bg-cyan-100 text-cyan-700 border-cyan-300 hover:bg-cyan-200',
  'Sin Requisitos': 'shadow-none bg-red-100 text-red-700 border-red-300 hover:bg-red-200',
  'No Responde': 'shadow-none bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200',
};

function formatStatus(status: string) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getEstadoColor(estado: string): string | undefined {
  const key = Object.keys(estadoColors).find((k) => k.toLowerCase() === estado.toLowerCase());
  return key ? estadoColors[key] : undefined;
}

function ProspectoInformacionAside({ prospecto, operadores }: { prospecto: FlotaProspectoRow; operadores: OperadorUser[] }) {
  return (
    <EntityInfoCard
      title="INFORMACION"
      collapsible
      fields={[
        { icon: User, value: prospecto.nombreCompleto },
        { icon: Phone, value: prospecto.celular || 'Sin teléfono', href: prospecto.celular ? `tel:${prospecto.celular}` : undefined },
        { icon: Globe, value: prospecto.redSocial || 'Sin fuente' },
        { icon: MapPin, value: prospecto.distrito || 'Sin distrito' },
        { icon: CalendarDays, value: `Registrado: ${prospecto.fechaRegistro ? formatDate(prospecto.fechaRegistro) : '—'}` },
        { icon: User, value: `Operador: ${getOperatorDisplayName(prospecto.operador, operadores) || '—'}` },
        { icon: Car, value: `Año Veh.: ${prospecto.anioVehiculo || '—'}` },
        { icon: MessageSquare, value: `Modalidad: ${prospecto.modalidad || '—'}` },
        { icon: ClipboardList, value: `Móvil: ${prospecto.movil || '—'}` },
        ...(prospecto.fechaAfiliacion ? [{ icon: Calendar, value: `Afiliación: ${formatDate(prospecto.fechaAfiliacion)}` }] : []),
        { icon: FileText, value: `Obs.: ${(prospecto.observaciones || '').split('\n---\n')[0].replace(/^(?:\[.+?\]\s*)+/, '').trim() || '—'}` },
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
  const [prospecto, setProspecto] = useState<FlotaProspectoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingEstado, setUpdatingEstado] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<FlotaProspectoRow>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);
  const TIMELINE_PAGE_SIZE = 7;

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string | null>(null);
  const [statusDate, setStatusDate] = useState('');
  const [statusTime, setStatusTime] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [files, setFiles] = useState<FlotaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [fileLightboxUrl, setFileLightboxUrl] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [llamadaModalOpen, setLlamadaModalOpen] = useState(false);
  const [llamadaFecha, setLlamadaFecha] = useState('');
  const [llamadaHora, setLlamadaHora] = useState('');
  const [llamadaNotas, setLlamadaNotas] = useState('');
  const [llamadaSaving, setLlamadaSaving] = useState(false);
  const [llamadas, setLlamadas] = useState<FlotaLlamada[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!id || !prospecto) return;
    setLoadingHistory(true);
    try {
      const { fetchActivityLogs, activityLogToTimelineEvent } = await import('@/lib/activityLogsApi');
      const res = await fetchActivityLogs({ 
        entityType: 'flota-prospecto', 
        entityId: id,
        limit: 50 
      });
      const logs = res.data.map(activityLogToTimelineEvent);
      const hasCreation = logs.some((l: any) => l.type === 'crear');
      if (!hasCreation && prospecto.createdAt) {
        logs.push({
          id: 'initial-creation',
          type: 'crear',
          title: 'Sistema',
          description: 'El prospecto fue registrado en el sistema.',
          date: new Date(prospecto.createdAt).toLocaleString(),
          user: 'Sistema'
        });
      }
      setHistoryEvents(logs);
    } catch (e) {
      console.error('Error cargando historial:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [id, prospecto]);

  const totalTimelinePages = Math.ceil(historyEvents.length / TIMELINE_PAGE_SIZE);
  const paginatedEvents = useMemo(
    () => historyEvents.slice((timelinePage - 1) * TIMELINE_PAGE_SIZE, timelinePage * TIMELINE_PAGE_SIZE),
    [historyEvents, timelinePage],
  );

  useEffect(() => {
    if (timelinePage > totalTimelinePages && totalTimelinePages > 0) {
      setTimelinePage(totalTimelinePages);
    }
  }, [timelinePage, totalTimelinePages]);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await flotaProspectoDetail(id);
      setProspecto(data);
    } catch (e) {
      toast.error('No se pudo cargar el detalle del prospecto');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    fetchOperadores().then(setOperadores).catch(() => {});
  }, []);

  useEffect(() => {
    if (prospecto) {
      void fetchHistory();
    }
  }, [prospecto, fetchHistory]);

  const handleCambiarEstado = useCallback((nuevoEstado: string) => {
    if (!prospecto || updatingEstado) return;
    const now = new Date();
    setTargetStatus(nuevoEstado);
    setStatusDate(now.toISOString().split('T')[0]);
    setStatusTime(now.toTimeString().split(' ')[0].substring(0, 5));
    setStatusComment('');
    setIsReadOnly(false);
    setStatusModalOpen(true);
  }, [prospecto, updatingEstado]);

  const handleConfirmStatusChange = async () => {
    if (!prospecto || !targetStatus) return;
    setUpdatingEstado(true);
    try {
      const updated = await flotaProspectoUpdate(prospecto.id, { 
        estado: targetStatus,
        observaciones: statusComment || prospecto.observaciones
      });
      setProspecto(updated);
      setStatusModalOpen(false);
      toast.success(`Estado cambiado a ${formatStatus(targetStatus)}`);
      void fetchHistory();
    } catch (e) {
      toast.error('No se pudo cambiar el estado');
      console.error(e);
    } finally {
      setUpdatingEstado(false);
    }
  };

  const fetchFiles = useCallback(async () => {
    if (!prospecto?.id) return;
    setFilesLoading(true);
    try {
      const data = await flotaProspectoFiles(prospecto.id);
      setFiles(data);
      const imageFiles = data.filter((f) => f.mimeType.startsWith('image/'));
      const urls: Record<string, string> = {};
      await Promise.all(
        imageFiles.map(async (f) => {
          try {
            const { url } = await flotaProspectoFileContentUrl(f.id);
            urls[f.id] = url;
          } catch { /* silencioso */ }
        }),
      );
      setFileUrls(urls);
    } catch {
      toast.error('No se pudieron cargar los archivos');
    } finally {
      setFilesLoading(false);
    }
  }, [prospecto?.id]);

  useEffect(() => {
    if (activeTab === 'archivos') {
      void fetchFiles();
    }
  }, [activeTab, fetchFiles]);

  const fetchLlamadas = useCallback(async () => {
    if (!prospecto?.id) return;
    try {
      const data = await flotaLlamadasList(prospecto.id);
      setLlamadas(data);
    } catch {
      toast.error('No se pudieron cargar las llamadas');
    }
  }, [prospecto?.id]);

  useEffect(() => {
    if (activeTab === 'llamadas') {
      void fetchLlamadas();
    }
  }, [activeTab, fetchLlamadas]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !prospecto?.id) return;
    setUploadLoading(true);
    try {
      await flotaProspectoUploadFile(prospecto.id, file);
      toast.success('Archivo subido');
      void fetchFiles();
    } catch {
      toast.error('No se pudo subir el archivo');
    } finally {
      setUploadLoading(false);
    }
    e.target.value = '';
  }, [prospecto?.id, fetchFiles]);


  const handleAddLlamada = useCallback(async () => {
    if (!prospecto?.id) return;
    setLlamadaSaving(true);
    try {
      const fechaHora = new Date(`${llamadaFecha}T${llamadaHora}:00`);
      const newLlamada = await flotaLlamadaCreate(prospecto.id, {
        notas: llamadaNotas.trim() || null,
        createdAt: fechaHora.toISOString(),
      });
      setLlamadas((prev) => [newLlamada, ...prev]);
    } catch {
      toast.error('No se pudo registrar la llamada');
    } finally {
      setLlamadaSaving(false);
      setLlamadaModalOpen(false);
    }
  }, [prospecto?.id, llamadaFecha, llamadaHora, llamadaNotas]);

  const openFilePreview = useCallback(async (file: FlotaFile) => {
    if (file.mimeType.startsWith('image/')) {
      try {
        const { url } = await flotaProspectoFileContentUrl(file.id);
        setFileLightboxUrl(url);
      } catch {
        toast.error('No se pudo obtener la vista previa');
      }
    } else {
      try {
        const { url } = await flotaProspectoFileContentUrl(file.id);
        window.open(url, '_blank');
      } catch {
        toast.error('No se pudo abrir el archivo');
      }
    }
  }, []);

  const handleEventClick = useCallback((event: any) => {
    if (event.type !== 'cambio_estado') return;

    const desc = event.description || '';
      // Intentar extraer info del string: "Cambio de estado: AFILIADO -> CITADO. Comentario: ..."
      const matchStatus = desc.match(/->\s+(.+?)\./);
      const matchComment = desc.match(/Comentario:\s+(.+)$/);
      
      setTargetStatus(matchStatus?.[1] || null);
      // La fecha/hora la tomamos del evento mismo
      const eventDate = (() => { const [y, m, d] = event.date.split('-').map(Number); return new Date(y, m - 1, d); })();
      if (!isNaN(eventDate.getTime())) {
        setStatusDate(eventDate.toISOString().split('T')[0]);
        setStatusTime(eventDate.toTimeString().split(' ')[0].substring(0, 5));
      }
      setStatusComment(matchComment?.[1] || '');
      setIsReadOnly(true);
      setStatusModalOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
              className={cn(
              "h-9 transition-colors",
              getEstadoColor(prospecto.estado)
            )}
            disabled={updatingEstado}
          >
            {formatStatus(prospecto.estado)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {ESTADOS.filter(e => e !== prospecto.estado).map(estado => (
            <DropdownMenuItem
              key={estado}
              onClick={() => handleCambiarEstado(estado)}
              className={cn(
                "cursor-pointer mt-1 first:mt-0"
              )}
            >
              {formatStatus(estado)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* QuickActionsWithDialogs eliminado por petición (botón Crear) */}
      <Button 
        className="gap-1.5 bg-whatsapp px-3 text-whatsapp-foreground hover:bg-whatsapp/90 h-9"
        onClick={() => navigate(`/flota/mensajes?chat=${prospecto?.id}`)}
      >
        <MessageSquare className="size-4" />
        WhatsApp
      </Button>
      <Button
        variant="outline"
        className="gap-1.5 h-9"
        onClick={() => {
          const now = new Date();
          setLlamadaFecha(now.toISOString().split('T')[0]);
          setLlamadaHora(now.toTimeString().split(' ')[0].substring(0, 5));
          setLlamadaNotas('');
          setLlamadaModalOpen(true);
        }}
      >
        <Phone className="size-4" />
        Llamada
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-lg text-text-secondary hover:bg-accent hover:text-accent-foreground"
        onClick={() => {
          setEditData({
            ...prospecto,
            observaciones: (prospecto.observaciones || '').split('\n---\n')[0].replace(/^(?:\[.+?\]\s*)+/, ''),
            operador: getOperatorDisplayName(prospecto.operador, operadores),
          });
          setEditModalOpen(true);
        }}
      >
        <Edit className="size-4" />
      </Button>
    </div>
  );

  const handleSaveEdit = async () => {
    if (!prospecto) return;
    setSavingEdit(true);
    try {
      const { operador, observaciones, ...otherData } = editData;
      let finalObs = observaciones || null;
      if (finalObs !== undefined && prospecto.observaciones) {
        const latestText = prospecto.observaciones.split('\n---\n')[0].replace(/^(?:\[.+?\]\s*)+/, '');
        if (finalObs !== latestText) {
          const dateStr = new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' });
          finalObs = `[${dateStr}] ${finalObs}\n---\n${prospecto.observaciones}`;
        } else {
          finalObs = prospecto.observaciones;
        }
      }
      const updated = await flotaProspectoUpdate(prospecto.id, { ...otherData, observaciones: finalObs });
      if (operador !== prospecto.operador) {
        try {
          await api(`/flota-prospectos/${prospecto.id}/operador`, {
            method: 'PATCH',
            body: JSON.stringify({ operador: operador || null }),
          });
          updated.operador = operador || null;
        } catch {
          toast.error('No tienes permiso para asignar operador');
        }
      }
      setProspecto(updated);
      setEditModalOpen(false);
      toast.success('Prospecto actualizado');
      try { new BroadcastChannel("flota-prospectos").postMessage({ type: "refresh" }); } catch {}
    } catch (e) {
      toast.error('No se pudo actualizar');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <DetailLayout
      backPath="/flota/prospectos"
      title={prospecto.nombreCompleto}
      subtitle={`Celular: ${prospecto.celular || '—'}`}
      headerActions={headerActions}
      leftAside={<ProspectoInformacionAside prospecto={prospecto} operadores={operadores} />}
      sidebar={<ProspectoArchivosAside />}
    >
      <div className="space-y-6">
        {prospecto.esDuplicado && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="size-4 text-red-600" />
            <AlertTitle className="text-red-800">Prospecto Duplicado</AlertTitle>
            <AlertDescription className="text-red-700">
              Este número de celular ya existe en la base de datos de prospectos.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-1">
            <TabsList variant="line" className="w-full overflow-x-auto justify-start">
              <TabsTrigger value="historial" className="text-xs px-2 sm:text-sm sm:px-4">Historial</TabsTrigger>

              <TabsTrigger value="archivos" className="text-xs px-2 sm:text-sm sm:px-4">Archivos</TabsTrigger>
              <TabsTrigger value="llamadas" className="text-xs px-2 sm:text-sm sm:px-4">Llamadas</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="historial" className="mt-4">
            <Card>
              <CardContent className="p-4 sm:p-5">
                {loadingHistory ? (
                  <div className="flex justify-center py-10 text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : historyEvents.length > 0 ? (
                  <div className="space-y-4">
                    <TimelinePanel
                      events={paginatedEvents}
                      onEventClick={handleEventClick}
                    />
                    {historyEvents.length > TIMELINE_PAGE_SIZE && (
                      <div className="-mx-4 flex flex-col gap-3 border-t border-border/60 px-4 pt-4 sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <p className="text-xs text-muted-foreground">
                          Mostrando {(timelinePage - 1) * TIMELINE_PAGE_SIZE + 1} a {Math.min(timelinePage * TIMELINE_PAGE_SIZE, historyEvents.length)} de {historyEvents.length} eventos
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTimelinePage((p) => Math.max(1, p - 1))}
                            disabled={timelinePage === 1}
                          >
                            <ChevronLeft className="size-4" />
                            Anterior
                          </Button>
                          <span className="min-w-[72px] text-center text-xs text-muted-foreground">
                            {timelinePage} / {totalTimelinePages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTimelinePage((p) => Math.min(totalTimelinePages, p + 1))}
                            disabled={timelinePage === totalTimelinePages}
                          >
                            Siguiente
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Clock className="mx-auto mb-2 size-8 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">No hay actividad registrada aún.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="archivos" className="mt-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {files.length > 0 ? `${files.length} archivo${files.length !== 1 ? 's' : ''}` : 'Sin archivos'}
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Upload className="h-4 w-4" />
                Subir archivo
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadLoading} />
              </label>
            </div>
            {filesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileArchive className="mb-4 size-12 text-muted-foreground/20" />
                  <h3 className="text-lg font-medium">Sin archivos adjuntos</h3>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Sube DNI, licencia de conducir u otros documentos necesarios para el proceso.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => void openFilePreview(f)}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border/50 bg-surface-elevated/50 transition-colors hover:bg-surface-elevated"
                  >
                    {f.mimeType.startsWith('image/') && fileUrls[f.id] ? (
                      <img
                        src={fileUrls[f.id]}
                        alt={f.originalName}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <div className={`${f.mimeType.startsWith('image/') && fileUrls[f.id] ? 'hidden' : ''} flex h-full w-full flex-col items-center justify-center gap-2 p-2`}>
                      {f.mimeType.startsWith('video/') ? (
                        <Video className="h-8 w-8 text-muted-foreground" />
                      ) : f.mimeType.includes('pdf') ? (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <FileArchive className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className="line-clamp-2 text-center text-xs text-muted-foreground">{f.originalName}</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Eye className="h-6 w-6 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="llamadas" className="mt-4">
            <Card>
              <CardContent className="p-4 sm:p-5">
                {llamadas.length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">No hay llamadas registradas</p>
                ) : (
                  <div className="space-y-3">
                    {llamadas.map((ll) => (
                      <div key={ll.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">{ll.userName}</span>
                          <span>{new Date(ll.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</span>
                        </div>
                        {ll.notas && <p className="text-sm whitespace-pre-wrap">{ll.notas}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editModalOpen} onOpenChange={(open) => setEditModalOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Prospecto</DialogTitle>
            <DialogDescription>
              Actualiza los datos del prospecto.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre completo</Label>
              <Input
                value={editData.nombreCompleto || ''}
                onChange={(e) => setEditData({ ...editData, nombreCompleto: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Celular</Label>
              <Input
                value={editData.celular || ''}
                onChange={(e) => setEditData({ ...editData, celular: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Edad</Label>
                <Input
                  type="number"
                  value={editData.edad ?? ''}
                  onChange={(e) => setEditData({ ...editData, edad: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Año Vehículo</Label>
                <Input
                  type="number"
                  value={editData.anioVehiculo ?? ''}
                  onChange={(e) => setEditData({ ...editData, anioVehiculo: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Red Social</Label>
                <Input
                  value={editData.redSocial || ''}
                  onChange={(e) => setEditData({ ...editData, redSocial: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Operador</Label>
                <Select
                  value={editData.operador || '__none__'}
                  onValueChange={(v) => setEditData({ ...editData, operador: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin operador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin operador</SelectItem>
                    {operadores.map((op) => (
                      <SelectItem key={op.id} value={op.name}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Modalidad</Label>
                <Input
                  value={editData.modalidad || ''}
                  onChange={(e) => setEditData({ ...editData, modalidad: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Distrito</Label>
                <Input
                  value={editData.distrito || ''}
                  onChange={(e) => setEditData({ ...editData, distrito: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={editData.estado || ''}
                onValueChange={(v) => setEditData({ ...editData, estado: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(estado => (
                    <SelectItem key={estado} value={estado}>
                      {formatStatus(estado)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Input
                value={editData.observaciones || ''}
                onChange={(e) => setEditData({ ...editData, observaciones: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isReadOnly ? 'Detalle de Registro' : `Cambiar Estado: ${targetStatus ? formatStatus(targetStatus) : ''}`}
            </DialogTitle>
            <DialogDescription>
              {isReadOnly 
                ? 'Información registrada para este cambio de estado.' 
                : 'Registra la fecha y hora de este cambio de estado.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="statusDate">Fecha de registro</Label>
                <Input
                  id="statusDate"
                  type="date"
                  value={statusDate}
                  readOnly={isReadOnly}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className={cn(isReadOnly && "bg-muted cursor-default border-transparent focus-visible:ring-0")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="statusTime">Hora de registro</Label>
                <Input
                  id="statusTime"
                  type="time"
                  value={statusTime}
                  readOnly={isReadOnly}
                  onChange={(e) => setStatusTime(e.target.value)}
                  className={cn(isReadOnly && "bg-muted cursor-default border-transparent focus-visible:ring-0")}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="statusComment">Comentarios</Label>
              <textarea
                id="statusComment"
                className={cn(
                  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                  isReadOnly && "bg-muted cursor-default border-transparent focus-visible:ring-0"
                )}
                placeholder={isReadOnly ? '' : "Escribe un comentario sobre este cambio..."}
                value={statusComment}
                readOnly={isReadOnly}
                onChange={(e) => setStatusComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant={isReadOnly ? 'secondary' : 'outline'} onClick={() => setStatusModalOpen(false)}>
              {isReadOnly ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!isReadOnly && (
              <Button onClick={handleConfirmStatusChange} disabled={updatingEstado}>
                {updatingEstado ? 'Guardando...' : 'Confirmar cambio'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={llamadaModalOpen} onOpenChange={setLlamadaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar llamada</DialogTitle>
            <DialogDescription>Fecha y hora de la llamada</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={llamadaFecha}
                  onChange={(e) => setLlamadaFecha(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={llamadaHora}
                  onChange={(e) => setLlamadaHora(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas / Comentarios</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Comentarios sobre la llamada..."
                value={llamadaNotas}
                onChange={(e) => setLlamadaNotas(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLlamadaModalOpen(false)} disabled={llamadaSaving}>
              Cancelar
            </Button>
            <Button onClick={handleAddLlamada} disabled={!llamadaNotas.trim() || llamadaSaving}>
              {llamadaSaving ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
              {llamadaSaving ? 'Guardando...' : 'Registrar llamada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fileLightboxUrl} onOpenChange={() => setFileLightboxUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 border-0 bg-black/95">
          <button
            type="button"
            onClick={() => setFileLightboxUrl(null)}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {fileLightboxUrl && (
            <img
              src={fileLightboxUrl}
              alt="Vista ampliada"
              className="max-h-[85vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </DetailLayout>
  );
}