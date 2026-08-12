import { useMemo, useState } from 'react';
import { MessageCircle, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  InboxThreadContextMenu,
  useInboxThreadContextMenu,
} from '@/components/shared/InboxThreadContextMenu';
import { useChatpoolStore } from './store';
import { ConversationCard } from './ConversationCard';
import { FlotaWhatsappConnectionBanner, FlotaWhatsappLoadingState } from './FlotaWhatsappConnectionBanner';
import { FLOTA_PROSPECTO_ESTADOS, formatProspectoEstado } from './prospectoEstado';
import { isWaConversationId } from './utils';
import type { Conversation } from './types';
import type { AssigneeFilter, ReadFilter } from './store';

const readTabs = [
  { id: 'all' as const, label: 'Todos' },
  { id: 'unread' as const, label: 'No leídos' },
];

const assigneeTabs = [
  { id: 'mine' as const, label: 'Mías' },
  { id: 'unassigned' as const, label: 'Sin asignar' },
  { id: 'all' as const, label: 'Todas' },
];

function matchesAssignee(
  conversation: Conversation,
  filter: AssigneeFilter,
  currentAgentName: string | null,
) {
  if (filter === 'mine') return !!currentAgentName && conversation.assignee?.name === currentAgentName;
  if (filter === 'unassigned') return !conversation.assignee;
  return true;
}

function matchesRead(conversation: Conversation, filter: ReadFilter) {
  if (filter === 'unread') return conversation.unreadCount > 0;
  return true;
}

function getConversationEstado(conversation: Conversation): string {
  if (conversation.prospectoActivo === false) return '';
  return conversation.labels[0]?.name ?? '';
}

function matchesEstado(conversation: Conversation, estado: string | null) {
  if (!estado) return true;
  const current = getConversationEstado(conversation);
  return current.toLowerCase() === estado.toLowerCase();
}

function matchesSearch(conversation: Conversation, searchQuery: string) {
  const haystack = [conversation.contact.name, conversation.contact.phone, conversation.contact.email, conversation.lastMessage?.content]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(searchQuery);
}

export function ConversationList() {
  const inboxName = useChatpoolStore((s) => s.inboxName);
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const conversationsLoading = useChatpoolStore((s) => s.conversationsLoading);
  const currentAgentName = useChatpoolStore((s) => s.currentAgentName);
  const conversations = useChatpoolStore((s) => s.conversations);
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const filterAssignee = useChatpoolStore((s) => s.filterAssignee);
  const filterRead = useChatpoolStore((s) => s.filterRead);
  const filterEstado = useChatpoolStore((s) => s.filterEstado);
  const openConversation = useChatpoolStore((s) => s.openConversation);
  const setFilterAssignee = useChatpoolStore((s) => s.setFilterAssignee);
  const setFilterRead = useChatpoolStore((s) => s.setFilterRead);
  const setFilterEstado = useChatpoolStore((s) => s.setFilterEstado);
  const deleteConversation = useChatpoolStore((s) => s.deleteConversation);
  const isReady = connectionState === 'ready';

  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const chatContextMenu = useInboxThreadContextMenu();
  const searchQuery = search.trim().toLowerCase();
  const isSearching = searchQuery.length > 0;

  const readCounts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => c.unreadCount > 0).length,
    }),
    [conversations],
  );

  const assigneeCounts = useMemo(
    () => ({
      mine: conversations.filter((c) => matchesAssignee(c, 'mine', currentAgentName)).length,
      unassigned: conversations.filter((c) => matchesAssignee(c, 'unassigned', currentAgentName)).length,
      all: conversations.length,
    }),
    [conversations, currentAgentName],
  );

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const estado of FLOTA_PROSPECTO_ESTADOS) {
      counts[estado] = conversations.filter((c) => matchesEstado(c, estado)).length;
    }
    return counts;
  }, [conversations]);

  const filtered = useMemo(() => {
    if (isSearching) {
      return conversations.filter((c) => matchesSearch(c, searchQuery));
    }
    return conversations.filter(
      (c) =>
        matchesAssignee(c, filterAssignee, currentAgentName) &&
        matchesRead(c, filterRead) &&
        matchesEstado(c, filterEstado),
    );
  }, [
    conversations,
    filterAssignee,
    filterRead,
    filterEstado,
    isSearching,
    searchQuery,
    currentAgentName,
  ]);

  const contextMenuConversation = useMemo(
    () => conversations.find((c) => c.id === chatContextMenu.threadId) ?? null,
    [conversations, chatContextMenu.threadId],
  );

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteConversation(deleteTarget.id, {
        removeProspecto: deleteTarget.prospectoActivo !== false && !isWaConversationId(deleteTarget.id),
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-[320px] bg-card border-r border-border flex flex-col shrink-0 h-full">
      <div className="px-4 pt-4 pb-0">
        <div className="mb-3">
          <h2 className="truncate text-foreground font-semibold text-[15px]">{inboxName}</h2>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar en toda la bandeja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-transparent focus-visible:border-primary"
          />
        </div>

        {isSearching ? (
          <p className="mb-2 text-[11px] text-muted-foreground">
            Buscando en toda la bandeja ({filtered.length})
          </p>
        ) : null}

        <div
          className={cn(
            'mb-2 flex gap-1 rounded-lg bg-muted p-0.5',
            isSearching && 'pointer-events-none opacity-50',
          )}
          role="tablist"
          aria-label="Filtro por lectura"
        >
          {readTabs.map((tab) => {
            const active = filterRead === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={isSearching}
                onClick={() => setFilterRead(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center transition-colors',
                  active
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="text-[11px] font-medium leading-tight">{tab.label}</span>
                <span className={cn('text-[10px] tabular-nums leading-none', active ? 'text-primary/70' : 'text-muted-foreground')}>
                  {readCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            'grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.5',
            isSearching && 'pointer-events-none opacity-50',
          )}
          role="tablist"
          aria-label="Filtro por asignación"
        >
          {assigneeTabs.map((tab) => {
            const active = filterAssignee === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={isSearching}
                onClick={() => setFilterAssignee(tab.id)}
                className={cn(
                  'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center transition-colors',
                  active
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="w-full truncate text-[11px] font-medium leading-tight">{tab.label}</span>
                <span className={cn('text-[10px] tabular-nums leading-none', active ? 'text-primary/70' : 'text-muted-foreground')}>
                  {assigneeCounts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className={cn('mt-2', isSearching && 'pointer-events-none opacity-50')}>
          <Select
            value={filterEstado ?? '__all__'}
            onValueChange={(value) => setFilterEstado(value === '__all__' ? null : value)}
            disabled={isSearching}
          >
            <SelectTrigger className="h-9 bg-muted/50 border-transparent text-xs">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los estados ({conversations.length})</SelectItem>
              {FLOTA_PROSPECTO_ESTADOS.map((estado) => (
                <SelectItem key={estado} value={estado}>
                  {formatProspectoEstado(estado)} ({estadoCounts[estado] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 border-b border-border" />
      </div>

      <FlotaWhatsappConnectionBanner state={connectionState} />

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {connectionState === 'loading' || (isReady && conversationsLoading && conversations.length === 0) ? (
          <FlotaWhatsappLoadingState />
        ) : !isReady ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageCircle className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm font-medium">Bandeja no disponible</p>
            <p className="text-muted-foreground/70 text-xs mt-1">Configura Evolution GO para empezar</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <MessageCircle className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm font-medium">Sin conversaciones</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              {filterRead === 'unread'
                ? 'No hay conversaciones sin leer con estos filtros'
                : filterEstado
                  ? `No hay conversaciones en estado ${formatProspectoEstado(filterEstado)}`
                  : 'No hay conversaciones en esta vista'}
            </p>
          </div>
        ) : (
          filtered.map((conv) => (
            <div
              key={conv.id}
              onContextMenu={(event) => {
                if (!isReady) return;
                chatContextMenu.openMenu(event, conv.id);
              }}
            >
              <ConversationCard
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onClick={() => openConversation(conv.id)}
              />
            </div>
          ))
        )}
      </div>

      <InboxThreadContextMenu
        open={chatContextMenu.open}
        x={chatContextMenu.x}
        y={chatContextMenu.y}
        onClose={chatContextMenu.closeMenu}
        items={
          contextMenuConversation
            ? [
                {
                  id: 'delete-chat',
                  label: 'Eliminar chat',
                  icon: Trash2,
                  destructive: true,
                  onSelect: () => setDeleteTarget(contextMenuConversation),
                },
              ]
            : []
        }
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar chat</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Se borrará todo el historial de WhatsApp de{' '}
                  <span className="font-medium text-foreground">{deleteTarget?.contact.name}</span>.
                </p>
                {deleteTarget && deleteTarget.prospectoActivo !== false && !isWaConversationId(deleteTarget.id) ? (
                  <p>Si el prospecto fue creado desde WhatsApp, también se quitará del CRM.</p>
                ) : null}
                <p>Podrás volver a probar cuando el contacto escriba de nuevo.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmDelete()} disabled={deleting}>
              {deleting ? 'Eliminando…' : 'Eliminar chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
