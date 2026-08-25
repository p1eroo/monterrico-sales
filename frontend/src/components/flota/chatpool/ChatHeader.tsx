import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Loader2, MessageCircle, PanelRightOpen } from 'lucide-react';
import { ProspectoInfoModal } from '@/components/flota/ProspectoInfoModal';
import { RegistrarLlamadaButton } from '@/components/flota/RegistrarLlamadaButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  fetchOperadores,
  type FlotaProspectoRow,
  type OperadorUser,
} from '@/lib/flotaProspectosApi';
import { cn } from '@/lib/utils';
import { ChatpoolAvatar } from './ui/Avatar';
import { useChatpoolStore } from './store';
import { formatCitaHeaderLabel, isWaConversationId } from './utils';
import type { Conversation } from './types';

const ASISTENCIA_OPTIONS = [
  { label: 'Asistió', value: 'Asistió' },
  { label: 'No Asistió', value: 'No Asistió' },
] as const;

function conversationToProspectoStub(conversation: Conversation): FlotaProspectoRow {
  return {
    id: conversation.id,
    nombreCompleto: conversation.contact.name,
    celular: conversation.contact.phone ?? null,
    estado: conversation.labels[0]?.name ?? 'Nuevo',
    operador: conversation.operador ?? conversation.assignee?.name ?? null,
    fechaCita: conversation.fechaCita ?? null,
    asistencia: conversation.asistencia ?? null,
    fechaRegistro: null,
    redSocial: null,
    edad: null,
    modalidad: null,
    anioVehiculo: null,
    placa: null,
    aireAcondicionado: null,
    distrito: null,
    ciudad: null,
    fechaAfiliacion: null,
    movil: null,
    observaciones: null,
    esDuplicado: false,
    origen: '',
    createdAt: '',
    updatedAt: '',
  };
}

interface ChatHeaderProps {
  conversation: Conversation;
}

export function ChatHeader({ conversation }: ChatHeaderProps) {
  const { contact } = conversation;
  const updateAsistencia = useChatpoolStore((s) => s.updateAsistencia);
  const contactSidebarOpen = useChatpoolStore((s) => s.contactSidebarOpen);
  const setContactSidebarOpen = useChatpoolStore((s) => s.setContactSidebarOpen);
  const [savingAsistencia, setSavingAsistencia] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [operadores, setOperadores] = useState<OperadorUser[]>([]);

  const prospectoActivo = conversation.prospectoActivo !== false;
  const canOpenInfo = prospectoActivo && !isWaConversationId(conversation.id);
  const infoProspecto = useMemo(
    () => (canOpenInfo ? conversationToProspectoStub(conversation) : null),
    [canOpenInfo, conversation],
  );

  const estado = conversation.labels[0]?.name ?? '';
  const isCitado = prospectoActivo && estado === 'Citado' && !!conversation.fechaCita;
  const citaLabel =
    isCitado && conversation.fechaCita ? formatCitaHeaderLabel(conversation.fechaCita) : '';
  const asistencia = conversation.asistencia?.trim() || null;

  useEffect(() => {
    if (!infoOpen) return;
    let cancelled = false;
    fetchOperadores()
      .then((ops) => {
        if (!cancelled) setOperadores(ops);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [infoOpen]);

  async function handleAsistencia(value: string) {
    if (savingAsistencia || value === asistencia) return;
    setSavingAsistencia(true);
    try {
      await updateAsistencia(conversation.id, value);
    } finally {
      setSavingAsistencia(false);
    }
  }

  const identityContent = (
    <>
      <div className="relative shrink-0">
        <ChatpoolAvatar name={contact.name} size="md" />
        {contact.lastSeen && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-foreground">{contact.name}</h2>
          <span className="hidden shrink-0 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full sm:flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </span>
        </div>
        {contact.lastSeen && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">En línea</p>
        )}
      </div>
    </>
  );

  return (
    <>
      <div className="h-14 bg-card border-b border-border flex items-center justify-between gap-3 px-4 shrink-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {canOpenInfo ? (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              title="Ver información del prospecto"
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-lg px-1.5 py-1 -ml-1.5 text-left',
                'transition-colors hover:bg-muted/70',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
              )}
            >
              {identityContent}
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-3">{identityContent}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {citaLabel ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={savingAsistencia}
                  title={asistencia ? `Cita · ${asistencia}` : 'Marcar asistencia'}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors',
                    'border-sky-500/25 bg-sky-500/10 text-sky-800 hover:bg-sky-500/15',
                    'dark:text-sky-300 dark:hover:bg-sky-500/20',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30',
                    'disabled:opacity-60',
                  )}
                >
                  {savingAsistencia ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <CalendarClock className="size-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate text-[11px] font-semibold tabular-nums">
                    {citaLabel}
                  </span>
                  {asistencia ? (
                    <span
                      className={cn(
                        'hidden sm:inline rounded px-1.5 py-0.5 text-[10px] font-medium',
                        asistencia === 'Asistió'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                      )}
                    >
                      {asistencia}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs text-muted-foreground">Cita</p>
                  <p className="text-sm font-medium tabular-nums">{citaLabel}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Asistencia
                </DropdownMenuLabel>
                {ASISTENCIA_OPTIONS.map((opt) => {
                  const selected = asistencia === opt.value;
                  return (
                    <DropdownMenuItem
                      key={opt.value}
                      disabled={savingAsistencia}
                      onClick={() => void handleAsistencia(opt.value)}
                      className="gap-2"
                    >
                      <Check className={cn('size-4', selected ? 'opacity-100' : 'opacity-0')} />
                      {opt.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {prospectoActivo ? (
            <RegistrarLlamadaButton
              prospectoId={conversation.id}
              prospectoNombre={contact.name}
            />
          ) : null}

          {!contactSidebarOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setContactSidebarOpen(true)}
              title="Abrir panel de contacto"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <ProspectoInfoModal
        prospecto={infoProspecto}
        operadores={operadores}
        open={infoOpen && !!infoProspecto}
        onOpenChange={setInfoOpen}
      />
    </>
  );
}
