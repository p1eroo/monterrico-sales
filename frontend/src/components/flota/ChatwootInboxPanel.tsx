import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Plus, Loader2, Inbox, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  fetchConversations,
  initiateConversation,
  fetchChatwootTemplates,
  fetchChatwootContacts,
  type ChatwootConversation,
  type ChatwootMessage,
  type ChatwootContact,
} from '@/lib/chatwootApi';
import { useAppStore } from '@/store';
import { ChatwootChatPanel } from '@/pages/flota/ChatwootInboxView';

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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialActiveId?: number | null;
}) {
  const [conversations, setConversations] = useState<ChatwootConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesCache, setMessagesCache] = useState<Record<number, ChatwootMessage[]>>({});
  const [filter, setFilter] = useState<'all' | 'unread' | 'contacts'>('all');
  const [contacts, setContacts] = useState<ChatwootContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [hasMoreContacts, setHasMoreContacts] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatTemplates, setNewChatTemplates] = useState<{ name: string; language: string; category: string; content?: string }[]>([]);
  const [newChatSelectedTemplate, setNewChatSelectedTemplate] = useState<string>('');
  const [newChatLoadingTemplates, setNewChatLoadingTemplates] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const convPageRef = useRef(1);
  const loadingConvRef = useRef(false);

  async function loadConversations() {
    try {
      const page1 = await fetchConversations({ page: 1 }) as ChatwootConversation[];
      page1.sort((a, b) => b.last_activity_at - a.last_activity_at);
      setConversations(page1);
      setLoading(false);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadConversations();
  }, [open]);

  useEffect(() => {
    if (initialActiveId) setActiveId(initialActiveId);
  }, [initialActiveId]);

  // Cargar más conversaciones al scrollear cerca del final
  useEffect(() => {
    if (loadingConvRef.current || conversations.length === 0) return;
    const items = virtualizer.getVirtualItems();
    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    if (lastItem.index >= conversations.length - 5) {
      loadingConvRef.current = true;
      const nextPage = convPageRef.current + 1;
      convPageRef.current = nextPage;
      fetchConversations({ page: nextPage }).then((raw) => {
        const items = raw as ChatwootConversation[];
        if (items.length > 0) {
          setConversations((prev) => {
            const merged = [...prev, ...items];
            merged.sort((a, b) => b.last_activity_at - a.last_activity_at);
            return merged;
          });
        }
      }).catch(() => {}).finally(() => { loadingConvRef.current = false; });
    }
  });



  function openNewChat(phone?: string, name?: string) {
    if (phone !== undefined) setNewChatPhone(phone);
    if (name !== undefined) setNewChatName(name);
    setNewChatSelectedTemplate('afiliacion_atu');
    setNewChatTemplates([]);
    setNewChatOpen(true);
    setNewChatLoadingTemplates(true);
    fetchChatwootTemplates()
      .then((tpls) => {
        setNewChatTemplates(tpls);
        if (tpls.length > 0) setNewChatSelectedTemplate(tpls[0].name);
      })
      .catch(() => {})
      .finally(() => setNewChatLoadingTemplates(false));
  }

  async function handleSendTemplate() {
    const phone = newChatPhone.trim();
    const name = newChatName.trim() || phone;
    const templateName = newChatSelectedTemplate;
    const template = newChatTemplates.find((t) => t.name === templateName);
    const finalName = template?.name || templateName || 'afiliacion_atu';
    const finalCategory = template?.category || 'UTILITY';
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
        operador: currentUser.name,
      });
      setNewChatOpen(false);
      setNewChatPhone('');
      setNewChatName('');
      await loadConversations();
      setTimeout(() => setActiveId(result.conversationId), 200);
      toast.success('Plantilla enviada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar plantilla');
    } finally {
      setCreatingChat(false);
    }
  }

  const queryLower = useMemo(() => query.toLowerCase(), [query]);

  // Cargar primera página al entrar a contactos o al buscar
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

  // Debounce para búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() =>
    conversations.filter((c) => {
      if (filter === 'unread') return (c.unread_count ?? 0) > 0;
      return true;
    }).filter((c) =>
      c.meta.sender.name.toLowerCase().includes(queryLower) ||
      c.meta.sender.phone_number?.includes(query),
    ),
    [conversations, filter, query, queryLower],
  );

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
                    conversations={conversations}
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
                        const existingConv = conversations.find((conv) =>
                          conv.meta.sender.phone_number?.replace(/\D/g, '') === c.phone_number?.replace(/\D/g, ''),
                        );
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
                              onClick={() => {
                                if (existingConv) {
                                  setActiveId(existingConv.id);
                                } else if (c.phone_number) {
                                  openNewChat(c.phone_number, c.name);
                                }
                              }}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
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
                              {existingConv && (
                                <span className="shrink-0 text-[10px] text-muted-foreground">En chat</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {query ? 'Sin resultados' : 'Sin conversaciones'}
                  </div>
                ) : (
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
                )}
              </div>
            </aside>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo mensaje</DialogTitle>
            <DialogDescription>Ingresa los datos y selecciona una plantilla para iniciar la conversación</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="panel-new-phone">Número de WhatsApp</Label>
              <Input id="panel-new-phone" value={newChatPhone} onChange={(e) => setNewChatPhone(e.target.value)} placeholder="+51999999999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panel-new-name">Nombre</Label>
              <Input id="panel-new-name" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} placeholder="Nombre del contacto" />
            </div>
            <div className="space-y-2">
              <Label>Plantilla</Label>
              {newChatLoadingTemplates ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas...
                </div>
              ) : newChatTemplates.length === 0 ? (
                <div className="rounded-lg border border-primary bg-primary/10 px-3 py-2">
                  <p className="font-medium text-xs">afiliacion_atu</p>
                  <p className="text-[10px] text-muted-foreground">UTILITY</p>
                  <div className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-foreground">
                    Hola estimado(a), reciba un cordial saludo de parte de Taxi Monterrico.{'\n\n'}
                    Hemos observado su interés en formar parte de nuestra flota.{'\n'}
                    ¿usted cuenta con vehiculo particular o tiene permiso de la ATU?
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {newChatTemplates.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setNewChatSelectedTemplate(t.name)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs text-left transition-colors',
                        newChatSelectedTemplate === t.name
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted',
                      )}
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.category}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendTemplate} disabled={!newChatPhone.trim() || !newChatSelectedTemplate || creatingChat}>
              {creatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {creatingChat ? 'Enviando...' : 'Enviar plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
