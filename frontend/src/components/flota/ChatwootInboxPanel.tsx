import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Plus, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  fetchConversations,
  fetchConversation,
  toListConversation,
  initiateConversation,
  fetchChatwootContacts,
  searchChatwootConversations,
  fetchUnreadConversations,
  conversationMatchesQuery,
  openContactChat,
  findConversationByPhone,
  markConversationAsRead,
  type ChatwootConversation,
  type ChatwootMessage,
  type ChatwootContact,
} from '@/lib/chatwootApi';
import { useAppStore } from '@/store';
import { ChatwootChatPanel } from '@/pages/flota/ChatwootInboxView';
import {
  useWhatsappTemplates,
  resolveSelectedTemplate,
  pickDefaultSendableTemplate,
} from '@/components/flota/WhatsappTemplatePicker';
import { WhatsappNewMessageDialog } from '@/components/flota/WhatsappNewMessageDialog';

const FILTERS = [
  ['all', 'Todos'],
  ['unread', 'No leídos'],
  ['contacts', 'Contactos'],
] as const;

const ConversationItem = memo(({
  conversation,
  isActive,
  index,
  start,
  measureElement,
  onClick,
}: {
  conversation: ChatwootConversation;
  isActive: boolean;
  index: number;
  start: number;
  measureElement: (el: HTMLElement | null) => void;
  onClick: (id: number) => void;
}) => {
  const dateStr = useMemo(() => {
    const d = new Date(conversation.last_activity_at * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString('es-PE', { weekday: 'short' });
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'numeric' });
  }, [conversation.last_activity_at]);

  return (
    <div
      data-index={index}
      ref={measureElement}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${start}px)`,
      }}
    >
      <button
        onClick={() => onClick(conversation.id)}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50',
          isActive && 'bg-muted',
        )}
      >
        <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden">
          {conversation.meta.sender.thumbnail ? (
            <img src={conversation.meta.sender.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className={cn(
              'flex h-full w-full items-center justify-center text-xs font-semibold',
              (conversation.unread_count ?? 0) > 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary',
            )}>
              {conversation.meta.sender.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('truncate text-sm', (conversation.unread_count ?? 0) > 0 && 'font-semibold')}>
              {conversation.meta.sender.name}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {conversation.preview || conversation.messages?.[0]?.content || ''}
            </span>
            {(conversation.unread_count ?? 0) > 0 && (
              <span className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';

export default function ChatwootInboxPanel({
  open,
  onOpenChange,
  initialActiveId,
  initialContact,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialActiveId?: number | null;
  /** Nombre/teléfono del prospecto al abrir desde la tabla (chats fuera de la página 1). */
  initialContact?: { name?: string; phone?: string } | null;
}) {
  const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatwootConversation[]>([]);
  const [searching, setSearching] = useState(false);
  const [unreadList, setUnreadList] = useState<ChatwootConversation[]>([]);
  const [loadingUnread, setLoadingUnread] = useState(false);
  const [loadingUnreadMore, setLoadingUnreadMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMoreConv, setHasMoreConv] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<number, ChatwootMessage[]>>({});
  const [filter, setFilter] = useState<'all' | 'unread' | 'contacts'>('all');
  const [contacts, setContacts] = useState<ChatwootContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [hasMoreContacts, setHasMoreContacts] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatSelectedTemplate, setNewChatSelectedTemplate] = useState('afiliacion_atu');
  const { templates: newChatTemplates, loading: newChatLoadingTemplates } = useWhatsappTemplates(newChatOpen);
  const [creatingChat, setCreatingChat] = useState(false);

  useEffect(() => {
    if (!newChatOpen || newChatTemplates.length === 0) return;
    setNewChatSelectedTemplate(pickDefaultSendableTemplate(newChatTemplates));
  }, [newChatOpen, newChatTemplates]);
  const [openingContactId, setOpeningContactId] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const convPageRef = useRef(1);
  const loadingConvRef = useRef(false);
  const loadingPage1Ref = useRef(false);
  const loadPage1InFlightRef = useRef<Promise<void> | null>(null);
  const lastConvLoadAtRef = useRef(0);
  const hasConvDataRef = useRef(false);
  const unreadLoadInFlightRef = useRef<Promise<void> | null>(null);
  const unreadPageRef = useRef(1);
  const loadingUnreadMoreRef = useRef(false);
  const [hasMoreUnread, setHasMoreUnread] = useState(true);
  const activeIdRef = useRef<number | null>(null);

  async function loadConversations(force = false) {
    const now = Date.now();
    if (!force && loadPage1InFlightRef.current) {
      return loadPage1InFlightRef.current;
    }
    if (!force && hasConvDataRef.current && now - lastConvLoadAtRef.current < 30_000) {
      return;
    }
    if (loadingPage1Ref.current && !force) {
      return loadPage1InFlightRef.current ?? undefined;
    }

    const run = (async () => {
      loadingPage1Ref.current = true;
      try {
        convPageRef.current = 1;
        loadingConvRef.current = false;
        setLoading(true);
        const page1 = await fetchConversations({ page: 1 }) as ChatwootConversation[];
        page1.sort((a, b) => b.last_activity_at - a.last_activity_at);
        const keepId = activeIdRef.current;
        setConversations((prev) => {
          const active = keepId
            ? prev.find((c) => c.id === keepId) ?? page1.find((c) => c.id === keepId)
            : undefined;
          if (active && !page1.some((c) => c.id === active.id)) {
            return [active, ...page1];
          }
          return page1;
        });
        setHasMoreConv(page1.length >= 25);
        hasConvDataRef.current = page1.length > 0;
        lastConvLoadAtRef.current = Date.now();
      } catch {
        // silent
      } finally {
        loadingPage1Ref.current = false;
        setLoading(false);
      }
    })();

    loadPage1InFlightRef.current = run;
    try {
      await run;
    } finally {
      loadPage1InFlightRef.current = null;
    }
  }

  useEffect(() => {
    if (open) void loadConversations(!hasConvDataRef.current);
  }, [open]);

  useEffect(() => {
    if (initialActiveId) {
      setActiveId(initialActiveId);
      activeIdRef.current = initialActiveId;
    }
  }, [initialActiveId]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    markConversationAsRead(activeId).catch(() => {});
    setUnreadList((prev) => prev.filter((c) => c.id !== activeId));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unread_count: 0 } : c)),
    );
  }, [activeId]);

  // Chats fuera de la página 1 (p. ej. desde Prospectos): cargar e inyectar detalle
  useEffect(() => {
    if (!open || !initialActiveId) return;
    let cancelled = false;

    // Mostrar nombre/teléfono del prospecto de inmediato mientras llega el detalle
    if (initialContact?.name || initialContact?.phone) {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === initialActiveId);
        if (idx >= 0) {
          const existing = prev[idx];
          const existingName = existing.meta?.sender?.name;
          if (existingName && existingName !== 'Desconocido' && existing.meta?.sender?.phone_number) {
            return prev;
          }
          const next = [...prev];
          next[idx] = {
            ...existing,
            meta: {
              ...existing.meta,
              sender: {
                ...existing.meta.sender,
                name:
                  (existingName && existingName !== 'Desconocido' ? existingName : null)
                  || initialContact.name
                  || existingName
                  || initialContact.phone
                  || 'Desconocido',
                phone_number: existing.meta?.sender?.phone_number || initialContact.phone || '',
              },
            },
          };
          return next;
        }
        return [
          {
            id: initialActiveId,
            inbox_id: 0,
            status: 'open' as const,
            meta: {
              sender: {
                id: 0,
                name: initialContact.name || initialContact.phone || 'Desconocido',
                phone_number: initialContact.phone || '',
                email: '',
              },
            },
            last_activity_at: Date.now() / 1000,
          },
          ...prev,
        ];
      });
    }

    void fetchConversation(initialActiveId)
      .then((detail) => {
        if (cancelled) return;
        const normalized = toListConversation(detail, initialContact ?? undefined);
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === normalized.id);
          if (idx >= 0) {
            const next = [...prev];
            const existing = next[idx];
            const existingName = existing.meta?.sender?.name;
            next[idx] = {
              ...existing,
              ...normalized,
              meta: {
                ...normalized.meta,
                sender: {
                  ...normalized.meta.sender,
                  name:
                    (normalized.meta.sender.name && normalized.meta.sender.name !== 'Desconocido'
                      ? normalized.meta.sender.name
                      : null)
                    || (existingName && existingName !== 'Desconocido' ? existingName : null)
                    || initialContact?.name
                    || normalized.meta.sender.name,
                  phone_number:
                    normalized.meta.sender.phone_number
                    || existing.meta?.sender?.phone_number
                    || initialContact?.phone
                    || '',
                },
              },
            };
            return next;
          }
          return [normalized, ...prev];
        });
      })
      .catch(() => {
        /* el placeholder del prospecto ya cubre el encabezado */
      });

    return () => {
      cancelled = true;
    };
  }, [open, initialActiveId, initialContact?.name, initialContact?.phone]);

  function openNewChat(phone?: string, name?: string) {
    if (phone !== undefined) setNewChatPhone(phone);
    if (name !== undefined) setNewChatName(name);
    setNewChatSelectedTemplate('afiliacion_atu');
    setNewChatOpen(true);
  }

  async function handleSendTemplate() {
    const phone = newChatPhone.trim();
    const name = newChatName.trim() || phone;
    const template = resolveSelectedTemplate(newChatTemplates, newChatSelectedTemplate);
    const finalName = template.name;
    const finalCategory = template.category;
    const finalLanguage = template.language;
    const finalContent = template.content ?? '';
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '');
    const fullPhone = cleaned.length === 9 ? `51${cleaned}` : cleaned;
    setCreatingChat(true);
    try {
      const currentUser = useAppStore.getState().currentUser;
      const result = await initiateConversation({
        name,
        phone: fullPhone,
        templateName: finalName,
        templateCategory: finalCategory,
        templateLanguage: finalLanguage,
        templateContent: finalContent,
        operador: currentUser.name,
      });
      setNewChatOpen(false);
      setNewChatPhone('');
      setNewChatName('');
      await loadConversations(true);
      setTimeout(() => setActiveId(result.conversationId), 200);
      toast.success('Plantilla enviada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar plantilla');
    } finally {
      setCreatingChat(false);
    }
  }

  // Debounce para búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Búsqueda: prospectos en BD + filtro local en conversaciones cargadas
  useEffect(() => {
    if (filter === 'contacts' || !open || !debouncedQuery || debouncedQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    searchChatwootConversations(debouncedQuery)
      .then((items) => { if (!cancelled) setSearchResults(items); })
      .catch(() => { if (!cancelled) setSearchResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, filter, open]);

  async function loadUnreadList(options?: {
    force?: boolean;
    append?: boolean;
  }) {
    const { force = false, append = false } = options ?? {};

    if (append) {
      if (loadingUnreadMoreRef.current) return;
    } else if (unreadLoadInFlightRef.current) {
      return unreadLoadInFlightRef.current;
    }

    const page = append ? unreadPageRef.current + 1 : 1;
    if (!append) unreadPageRef.current = 1;
    else unreadPageRef.current = page;

    const run = (async () => {
      if (append) {
        loadingUnreadMoreRef.current = true;
        setLoadingUnreadMore(true);
      } else {
        setLoadingUnread(true);
      }
      try {
        const items = await fetchUnreadConversations({
          page,
          force: force && !append,
        });
        setUnreadList((prev) => {
          if (!append) return items;
          const map = new Map<number, ChatwootConversation>();
          for (const c of prev) map.set(c.id, c);
          for (const c of items) map.set(c.id, c);
          return Array.from(map.values()).sort(
            (a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0),
          );
        });
        setHasMoreUnread(items.length >= 25);
      } catch {
        if (!append) setUnreadList([]);
        if (!append) setHasMoreUnread(false);
      } finally {
        if (append) {
          loadingUnreadMoreRef.current = false;
          setLoadingUnreadMore(false);
        } else {
          setLoadingUnread(false);
        }
      }
    })();

    if (!append) {
      unreadLoadInFlightRef.current = run;
      try {
        await run;
      } finally {
        unreadLoadInFlightRef.current = null;
      }
      return;
    }

    await run;
  }

  useEffect(() => {
    if (filter !== 'unread' || !open || debouncedQuery) return;
    void loadUnreadList({ force: true });
  }, [filter, open, debouncedQuery]);

  const allConversations = useMemo(() => {
    const map = new Map<number, ChatwootConversation>();
    for (const c of conversations) map.set(c.id, c);
    for (const c of searchResults) map.set(c.id, c);
    for (const c of unreadList) map.set(c.id, c);
    return Array.from(map.values());
  }, [conversations, searchResults, unreadList]);

  async function handleContactClick(contact: ChatwootContact) {
    if (openingContactId === contact.id) return;
    setOpeningContactId(contact.id);
    try {
      const opened = await openContactChat(contact, allConversations);
      if (opened) {
        if (opened.conversation) {
          setConversations((prev) => {
            if (prev.some((c) => c.id === opened.conversation!.id)) return prev;
            return [opened.conversation!, ...prev].sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0));
          });
        } else {
          await loadConversations(true);
        }
        setFilter('all');
        setActiveId(opened.conversationId);
        return;
      }
      if (contact.phone_number) {
        openNewChat(contact.phone_number, contact.name);
      }
    } catch {
      toast.error('No se pudo abrir el chat del contacto');
    } finally {
      setOpeningContactId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!debouncedQuery) {
      if (filter === 'unread') return unreadList;
      return conversations;
    }

    const base = filter === 'unread' ? unreadList : conversations;
    const map = new Map<number, ChatwootConversation>();
    for (const c of base) {
      if (conversationMatchesQuery(c, debouncedQuery)) map.set(c.id, c);
    }
    for (const c of searchResults) map.set(c.id, c);
    return Array.from(map.values()).sort(
      (a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0),
    );
  }, [conversations, filter, debouncedQuery, searchResults, unreadList]);

  useEffect(() => {
    if (filter !== 'contacts' || !open) return;
    if (contacts.length > 0 && !debouncedQuery) return;
    setContacts([]);
    contactPageRef.current = 1;
    setHasMoreContacts(false);
    setLoadingContacts(true);
    fetchChatwootContacts({ page: 1, q: debouncedQuery || undefined })
      .then((items) => {
        setContacts(items);
        setHasMoreContacts(items.length > 0);
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, [filter, open, debouncedQuery]);

  // Cargar más páginas al scrollear cerca del final
  const contactPageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  useEffect(() => {
    if (filter !== 'contacts' || !hasMoreContacts || loadingMoreRef.current || contacts.length === 0 || debouncedQuery) return;
    const items = contactsVirtualizer.getVirtualItems();
    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    if (lastItem.index >= contacts.length - 5) {
      loadingMoreRef.current = true;
      const nextPage = contactPageRef.current + 1;
      contactPageRef.current = nextPage;
      fetchChatwootContacts({ page: nextPage })
        .then((newItems) => {
          setContacts((prev) => [...prev, ...newItems]);
          setHasMoreContacts(newItems.length > 0);
        })
        .catch(() => {})
        .finally(() => { loadingMoreRef.current = false; });
    }
  });

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  const contactsVirtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !open || debouncedQuery || filter === 'unread' || loading) return;
    const onScroll = () => {
      if (loadingPage1Ref.current || loadingConvRef.current || !hasMoreConv || conversations.length === 0) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
        loadingConvRef.current = true;
        const nextPage = convPageRef.current + 1;
        convPageRef.current = nextPage;
        fetchConversations({ page: nextPage }).then((raw) => {
          const newItems = raw as ChatwootConversation[];
          if (newItems.length > 0) {
            setConversations((prev) => {
              const merged = [...prev, ...newItems];
              merged.sort((a, b) => b.last_activity_at - a.last_activity_at);
              return merged;
            });
          }
          setHasMoreConv(newItems.length >= 25);
        }).catch(() => {}).finally(() => { loadingConvRef.current = false; });
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [open, debouncedQuery, filter, loading, hasMoreConv, conversations.length]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !open || debouncedQuery || filter !== 'unread' || loadingUnread) return;
    const onScroll = () => {
      if (loadingUnreadMoreRef.current || loadingUnreadMore || !hasMoreUnread || unreadList.length === 0) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
        void loadUnreadList({ append: true });
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [open, debouncedQuery, filter, hasMoreUnread, loadingUnread, loadingUnreadMore, unreadList.length]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" showCloseButton={false} className={`w-full p-0 flex flex-col ${activeId ? 'sm:max-w-[760px]' : 'sm:max-w-[420px]'}`}>
          <div className="flex flex-1 min-h-0 relative bg-background">
            {activeId && (
              <div className="absolute inset-0 z-10 bg-card flex flex-col">
                <div className="flex-1 min-h-0">
                  <ChatwootChatPanel
                    key={activeId}
                    conversationId={activeId}
                    conversations={allConversations}
                    onConversationsUpdated={setConversations}
                    messagesCache={messagesCache}
                    setMessagesCache={setMessagesCache}
                    defaultPanelOpen={false}
                    onBack={() => setActiveId(null)}
                  />
                </div>
              </div>
            )}
            <aside className="flex flex-col w-[420px] shrink-0 border-r border-muted">
              <div className="border-b border-muted px-3 pb-1.5 pt-1">
                <div className="flex gap-1">
                  {FILTERS.map(([key, label]) => (
                    <button key={key}
                      onClick={() => setFilter(key as typeof filter)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        filter === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-b border-muted px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar..." className="pl-9 h-8 text-xs" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openNewChat()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                {filter === 'contacts' ? (
                  loadingContacts ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      {query ? 'Sin resultados' : 'Sin contactos'}
                    </div>
                  ) : (
                    <div style={{ height: contactsVirtualizer.getTotalSize(), position: 'relative' }}>
                      {contactsVirtualizer.getVirtualItems().map((vi) => {
                        const c = contacts[vi.index];
                        const existingConv = findConversationByPhone(allConversations, c.phone_number);
                        const isOpening = openingContactId === c.id;
                        return (
                          <div
                            key={c.id}
                            data-index={vi.index}
                            ref={contactsVirtualizer.measureElement}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${vi.start}px)`,
                            }}
                          >
                            <button
                              onClick={() => void handleContactClick(c)}
                              disabled={isOpening}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors disabled:opacity-60"
                            >
                              <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden">
                                {c.thumbnail ? (
                                  <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                                    {c.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{c.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{c.phone_number || ''}</p>
                              </div>
                              {isOpening ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                              ) : existingConv ? (
                                <span className="shrink-0 text-[10px] text-muted-foreground">En chat</span>
                              ) : null}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (loading && filter !== 'unread' && !debouncedQuery) || (searching && debouncedQuery.length >= 2 && filtered.length === 0) || (filter === 'unread' && loadingUnread && filtered.length === 0 && !debouncedQuery) ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    {filter === 'unread' && !debouncedQuery && (
                      <p className="text-sm text-muted-foreground">Cargando no leídos...</p>
                    )}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {query ? 'Sin resultados' : filter === 'unread' ? 'No hay mensajes no leídos' : 'Sin conversaciones'}
                  </div>
                ) : (
                  <>
                    {filter === 'unread' && loadingUnread && !debouncedQuery && (
                      <div className="flex items-center justify-center gap-2 border-b border-muted py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Actualizando no leídos...
                      </div>
                    )}
                    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                      {virtualizer.getVirtualItems().map((vi) => {
                        const c = filtered[vi.index];
                        return (
                          <ConversationItem key={c.id} conversation={c} isActive={activeId === c.id}
                            index={vi.index} start={vi.start} measureElement={virtualizer.measureElement}
                            onClick={(id) => { setActiveId(activeId === id ? null : id); }} />
                        );
                      })}
                    </div>
                    {filter === 'unread' && loadingUnreadMore && (
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando más...
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        </SheetContent>
      </Sheet>

      <WhatsappNewMessageDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        phone={newChatPhone}
        name={newChatName}
        onPhoneChange={setNewChatPhone}
        onNameChange={setNewChatName}
        templates={newChatTemplates}
        loadingTemplates={newChatLoadingTemplates}
        selectedTemplate={newChatSelectedTemplate}
        onSelectTemplate={setNewChatSelectedTemplate}
        onSubmit={() => { void handleSendTemplate(); }}
        submitting={creatingChat}
        submitDisabled={!newChatPhone.trim() || !newChatSelectedTemplate}
        description="Ingresa los datos y selecciona una plantilla para iniciar la conversación"
      />
    </>
  );
}
