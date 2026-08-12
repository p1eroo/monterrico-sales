import { useEffect, useMemo, useState } from 'react';
import {
  PanelRightClose,
  Phone,
  X,
  Pencil,
  Lock,
  UserPlus,
  UserMinus,
  Loader2,
  ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchOperadores, getOperatorDisplayName, type OperadorUser } from '@/lib/flotaProspectosApi';
import { toast } from '@/lib/notify';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { useChatpoolStore } from './store';
import { FLOTA_PROSPECTO_ESTADOS, formatProspectoEstado } from './prospectoEstado';
import { ProspectoEditDialog } from './ProspectoEditDialog';
import {
  collectConversationAttachments,
  findConversationInList,
  getConductorCodigo,
  getMessagesForConversation,
  type ConversationAttachment,
} from './utils';
import { ConductorCodigoBadge } from './ui/ConductorCodigoBadge';
import { FileAttachmentCard } from './FileAttachmentCard';
import type { Conversation } from './types';

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp Business',
  email: 'Correo Electrónico',
  facebook: 'Facebook Messenger',
  instagram: 'Instagram DM',
  website: 'Chat Web',
};

export function ContactDetails() {
  const conversations = useChatpoolStore((s) => s.conversations);
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const messages = useChatpoolStore((s) => s.messages);
  const contactSidebarOpen = useChatpoolStore((s) => s.contactSidebarOpen);
  const setContactSidebarOpen = useChatpoolStore((s) => s.setContactSidebarOpen);
  const applyProspectoPatch = useChatpoolStore((s) => s.applyProspectoPatch);
  const createProspectoFromConversation = useChatpoolStore((s) => s.createProspectoFromConversation);
  const removeProspectoFromConversation = useChatpoolStore((s) => s.removeProspectoFromConversation);
  const [editOpen, setEditOpen] = useState(false);
  const [creatingProspecto, setCreatingProspecto] = useState(false);
  const [deletingProspecto, setDeletingProspecto] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const openLightbox = useChatpoolStore((s) => s.openLightbox);

  const conversation = useMemo(
    () => findConversationInList(conversations, activeConversationId),
    [conversations, activeConversationId],
  );

  const prospectoActivo = conversation?.prospectoActivo !== false;

  const activeMessages = useMemo(
    () => getMessagesForConversation(conversations, messages, activeConversationId),
    [conversations, messages, activeConversationId],
  );
  const { images, files } = useMemo(
    () => collectConversationAttachments(activeMessages),
    [activeMessages],
  );

  if (!contactSidebarOpen) return null;

  if (!conversation) {
    return (
      <aside className="w-[340px] bg-card border-l border-border flex flex-col shrink-0 h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Detalles</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setContactSidebarOpen(false)}>
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Selecciona una conversación para ver los detalles del contacto
          </p>
        </div>
      </aside>
    );
  }

  async function handleCreateProspecto() {
    if (!conversation) return;
    setCreatingProspecto(true);
    try {
      await createProspectoFromConversation(conversation.id);
    } finally {
      setCreatingProspecto(false);
    }
  }

  async function handleDeleteProspecto() {
    if (!conversation || !prospectoActivo) return;
    setDeletingProspecto(true);
    try {
      await removeProspectoFromConversation(conversation.id);
      setDeleteConfirmOpen(false);
    } finally {
      setDeletingProspecto(false);
    }
  }

  return (
    <>
      <aside className="w-[340px] bg-card border-l border-border flex flex-col shrink-0 h-full overflow-y-auto">
        <ContactHero
          conversation={conversation}
          onClose={() => setContactSidebarOpen(false)}
          onEdit={() => setEditOpen(true)}
          canEdit={prospectoActivo}
        />
        <ContactSummary conversation={conversation} prospectoActivo={prospectoActivo} />
        <ProspectoCrmActions
          prospectoActivo={prospectoActivo}
          creating={creatingProspecto}
          deleting={deletingProspecto}
          onCreate={() => void handleCreateProspecto()}
          onDelete={() => setDeleteConfirmOpen(true)}
        />
        {images.length > 0 ? (
          <MediaSection images={images} onImageClick={openLightbox} />
        ) : (
          <MediaSectionEmpty />
        )}
        <FilesSection files={files} />
      </aside>

      <ProspectoEditDialog
        prospectoId={prospectoActivo ? conversation.id : null}
        open={editOpen && prospectoActivo}
        onOpenChange={setEditOpen}
        onSaved={(data) => {
          applyProspectoPatch(conversation.id, {
            name: data.nombreCompleto,
            phone: data.celular,
            operador: data.operador,
            estado: data.estado ?? undefined,
            fechaCita: data.fechaCita,
            asistencia: data.asistencia,
          });
        }}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quitar o eliminar prospecto</DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{conversation.contact.name}</strong> de la tabla de prospectos.
              La conversación de WhatsApp no se borrará.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              className={cn(
                'h-9 gap-2 rounded-lg border-0 px-3 shadow-none text-xs font-medium',
                'bg-slate-600 text-white hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30',
                'dark:bg-slate-500 dark:hover:bg-slate-600',
              )}
              onClick={() => void handleDeleteProspecto()}
              disabled={deletingProspecto}
            >
              {deletingProspecto ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Quitar o eliminar prospecto'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContactHero({
  conversation,
  onClose,
  onEdit,
  canEdit,
}: {
  conversation: Conversation;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const { contact } = conversation;
  return (
    <div className="relative h-52 shrink-0 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center bg-primary">
        <span className="text-7xl font-semibold text-primary-foreground/90 select-none">
          {contact.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-black/35 text-white hover:bg-black/50 hover:text-white"
            title="Editar prospecto"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-black/35 text-white hover:bg-black/50 hover:text-white"
          onClick={onClose}
          title="Cerrar panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-lg font-semibold text-white mb-1">{contact.name}</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-white/80">En línea</span>
        </div>
      </div>
    </div>
  );
}

function ContactSummary({
  conversation,
  prospectoActivo,
}: {
  conversation: Conversation;
  prospectoActivo: boolean;
}) {
  const currentUser = useAppStore((s) => s.currentUser);
  const updateOperador = useChatpoolStore((s) => s.updateOperador);
  const updateEstado = useChatpoolStore((s) => s.updateEstado);
  const conductorCodigoByPhone = useChatpoolStore((s) => s.conductorCodigoByPhone);

  const [operadores, setOperadores] = useState<OperadorUser[]>([]);
  const [citadoDialogOpen, setCitadoDialogOpen] = useState(false);
  const [citadoDate, setCitadoDate] = useState('');
  const [savingCitado, setSavingCitado] = useState(false);

  useEffect(() => {
    fetchOperadores().then(setOperadores).catch(() => {});
  }, []);

  const resolvedOperador = getOperatorDisplayName(conversation.operador, operadores);
  const currentEstado = conversation.labels[0]?.name ?? '';
  const isOperadorRole = currentUser.role === 'operador';
  const canAssignOperador = !isOperadorRole || !conversation.operador;
  const conductorCodigo = getConductorCodigo(conversation.contact.phone, conductorCodigoByPhone);

  async function handleOperadorChange(value: string) {
    const next = value === '__none__' ? null : value;
    await updateOperador(conversation.id, next, operadores);
  }

  async function handleEstadoChange(value: string) {
    if (value === 'Citado') {
      setCitadoDate('');
      setCitadoDialogOpen(true);
      return;
    }
    await updateEstado(conversation.id, value);
  }

  async function handleSaveCitado() {
    if (!citadoDate) return;
    setSavingCitado(true);
    try {
      await updateEstado(conversation.id, 'Citado', { fechaCita: citadoDate });
      setCitadoDialogOpen(false);
    } finally {
      setSavingCitado(false);
    }
  }

  return (
    <>
      <div className="p-4 space-y-4 border-b border-border">
        {conversation.contact.phone && (
          <div className="flex items-center gap-3 flex-wrap">
            <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground">{conversation.contact.phone}</span>
            {conductorCodigo ? <ConductorCodigoBadge codigo={conductorCodigo} /> : null}
          </div>
        )}

        <DetailRow label="Canal" value={channelLabels[conversation.channelType] ?? conversation.channelType} />

        {prospectoActivo ? (
          <>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Operador</p>
              <Select
                value={resolvedOperador || '__none__'}
                onValueChange={(v) => void handleOperadorChange(v)}
                disabled={!canAssignOperador}
              >
                <SelectTrigger
                  className={cn(
                    'h-10 bg-muted/50 border-transparent',
                    !canAssignOperador && 'opacity-60 cursor-not-allowed',
                  )}
                >
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
              {!canAssignOperador && conversation.operador ? (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Solo un supervisor puede reasignar
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Estado</p>
              <Select
                value={currentEstado || undefined}
                onValueChange={(v) => void handleEstadoChange(v)}
              >
                <SelectTrigger className="h-10 bg-muted/50 border-transparent">
                  <SelectValue placeholder="Sin estado" />
                </SelectTrigger>
                <SelectContent>
                  {FLOTA_PROSPECTO_ESTADOS.map((est) => (
                    <SelectItem key={est} value={est}>
                      {formatProspectoEstado(est)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5">
            <p className="text-sm text-muted-foreground">
              Este contacto no está registrado como prospecto en el CRM.
            </p>
          </div>
        )}
      </div>

      <Dialog open={citadoDialogOpen} onOpenChange={setCitadoDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Programar cita</DialogTitle>
            <DialogDescription>Ingresa la fecha de la cita para este prospecto.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="date"
              value={citadoDate}
              onChange={(e) => setCitadoDate(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCitadoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveCitado()} disabled={!citadoDate || savingCitado}>
              Guardar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProspectoCrmActions({
  prospectoActivo,
  creating,
  deleting,
  onCreate,
  onDelete,
}: {
  prospectoActivo: boolean;
  creating: boolean;
  deleting: boolean;
  onCreate: () => void;
  onDelete: () => void;
}) {
  const panelActionBase =
    'h-9 w-full gap-2 rounded-lg border-0 shadow-none justify-center text-xs font-medium focus-visible:ring-2';

  return (
    <div className="p-4 border-b border-border space-y-2">
      {prospectoActivo ? (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            panelActionBase,
            'bg-slate-600 text-white hover:bg-slate-700 focus-visible:ring-slate-500/30',
            'dark:bg-slate-500 dark:hover:bg-slate-600',
          )}
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <UserMinus className="size-4 shrink-0" />
          )}
          Quitar o eliminar prospecto
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            panelActionBase,
            'bg-info text-info-foreground hover:bg-info/90 focus-visible:ring-info/30',
          )}
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <UserPlus className="size-4 shrink-0" />
          )}
          Agregar al CRM
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {prospectoActivo
          ? 'Elimina el prospecto de la tabla sin borrar el chat de WhatsApp.'
          : 'Crea el prospecto en el CRM y vincula los mensajes existentes.'}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">{value}</div>
    </div>
  );
}

function MediaSection({
  images,
  onImageClick,
}: {
  images: ConversationAttachment[];
  onImageClick: (messageId: string) => void;
}) {
  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Media ({images.length})
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {images.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onImageClick(item.messageId)}
            className="aspect-square overflow-hidden rounded-lg border border-border bg-muted ring-1 ring-border hover:opacity-90 transition-opacity"
            title={item.name}
          >
            <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MediaSectionEmpty() {
  return (
    <div className="p-4 border-b border-border">
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Media</h4>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-6 text-center">
        <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No hay fotos en esta conversación</p>
      </div>
    </div>
  );
}

function FilesSection({ files }: { files: ConversationAttachment[] }) {
  return (
    <div className="p-4">
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Archivos ({files.length})
      </h4>
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No hay archivos en esta conversación</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileAttachmentCard
              key={file.id}
              fileName={file.name}
              fileSize={file.size}
              fileUrl={file.url}
              attachmentUrl={file.url}
              attachmentId={file.id}
              variant="incoming"
            />
          ))}
        </div>
      )}
    </div>
  );
}
