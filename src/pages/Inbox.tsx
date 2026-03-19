import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  PenSquare,
  Inbox,
  Send,
  FileEdit,
  Star,
  Trash2,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  ChevronLeft,
  MoreHorizontal,
  User,
  Building2,
  Target,
  Link2,
} from 'lucide-react';
import type { EmailThread, EmailFolder } from '@/types';
import { emailThreads, folderLabels, entityTypeLabels } from '@/data/emailMock';
import { useAppStore } from '@/store';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const FOLDERS: { id: EmailFolder; icon: typeof Inbox; label: string }[] = [
  { id: 'inbox', icon: Inbox, label: 'Recibidos' },
  { id: 'sent', icon: Send, label: 'Enviados' },
  { id: 'drafts', icon: FileEdit, label: 'Borradores' },
  { id: 'starred', icon: Star, label: 'Destacados' },
  { id: 'trash', icon: Trash2, label: 'Papelera' },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Ayer';
  if (days < 7) return d.toLocaleDateString('es-PE', { weekday: 'short' });
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEntityIcon(type: string) {
  switch (type) {
    case 'contact':
      return User;
    case 'company':
      return Building2;
    case 'opportunity':
      return Target;
    default:
      return Link2;
  }
}

export default function InboxPage() {
  const navigate = useNavigate();
  const gmailConnected = useAppStore((s) => s.gmailConnected);
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [starredThreads, setStarredThreads] = useState<Set<string>>(new Set(['thread1', 'thread3']));
  const [readThreads, setReadThreads] = useState<Set<string>>(new Set(['thread4', 'thread5']));

  const filteredThreads = useMemo(() => {
    return emailThreads.filter((thread) => {
      const lastMsg = thread.messages[0];
      const inFolder =
        activeFolder === 'starred'
          ? starredThreads.has(thread.id)
          : lastMsg.folder === activeFolder;
      const matchSearch =
        !search ||
        thread.subject.toLowerCase().includes(search.toLowerCase()) ||
        lastMsg.fromName.toLowerCase().includes(search.toLowerCase()) ||
        (thread.relatedEntityName ?? '').toLowerCase().includes(search.toLowerCase());
      return inFolder && matchSearch;
    });
  }, [activeFolder, search, starredThreads]);

  const toggleStar = (threadId: string) => {
    setStarredThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const markAsRead = (threadId: string) => {
    setReadThreads((prev) => new Set(prev).add(threadId));
  };

  const isThreadUnread = (thread: EmailThread) => !readThreads.has(thread.id);
  const isThreadStarred = (thread: EmailThread) => starredThreads.has(thread.id);

  if (!gmailConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20 p-12">
        <div className="flex size-20 items-center justify-center rounded-full bg-[#ea4335]/10">
          <svg className="size-10" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.883l8.073-6.39C21.69 2.28 24 3.434 24 5.457z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Conecta Gmail</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Conecta tu cuenta de Gmail para ver y gestionar tus correos desde el CRM. Los correos se sincronizarán con contactos y oportunidades.
          </p>
        </div>
        <Button
          className="bg-[#13944C] hover:bg-[#0f7a3d]"
          onClick={() => navigate('/profile?tab=integraciones')}
        >
          Ir a Mi perfil → Integraciones
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 md:-m-6 md:h-[calc(100vh-7rem)]">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/30 lg:flex">
        <div className="p-3">
          <Button
            className="w-full bg-[#13944C] hover:bg-[#0f7a3d]"
            onClick={() => setComposeOpen(true)}
          >
            <PenSquare className="size-4" />
            Nuevo correo
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFolder(f.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  activeFolder === f.id
                    ? 'bg-[#13944C]/10 text-[#13944C] font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {f.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Email list */}
      <div className="flex min-w-0 flex-1 flex-col border-r">
        {/* Mobile folder tabs */}
        <div className="flex gap-1 overflow-x-auto border-b p-2 lg:hidden">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFolder(f.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
                  activeFolder === f.id
                    ? 'bg-[#13944C] text-white'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="size-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-b p-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar correos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredThreads.map((thread) => {
              const lastMsg = thread.messages[0];
              const unread = isThreadUnread(thread);
              const starred = isThreadStarred(thread);
              const preview = lastMsg.body.slice(0, 80).replace(/\n/g, ' ') + '...';
              return (
                <div
                  key={thread.id}
                  onClick={() => {
                    setSelectedThread(thread);
                    markAsRead(thread.id);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                    selectedThread?.id === thread.id && 'bg-muted/70',
                    unread && 'bg-[#13944C]/5'
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(thread.id);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-amber-500"
                  >
                    <Star
                      className={cn('size-4', starred && 'fill-amber-500 text-amber-500')}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate',
                          unread ? 'font-semibold' : 'font-medium'
                        )}
                      >
                        {lastMsg.fromName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(lastMsg.timestamp)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'truncate text-sm',
                        unread ? 'font-medium' : 'text-muted-foreground'
                      )}
                    >
                      {thread.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{preview}</p>
                  </div>
                  {thread.relatedEntityName && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {entityTypeLabels[thread.relatedEntityType ?? 'contact']}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
          {filteredThreads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="size-12 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No hay correos</p>
              <p className="text-xs text-muted-foreground">
                {activeFolder === 'inbox' ? 'Tu bandeja está vacía' : `No hay correos en ${folderLabels[activeFolder]}`}
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Email detail */}
      <div
        className={cn(
          'hidden flex-1 flex-col border-l bg-background md:flex',
          !selectedThread && 'md:hidden lg:flex lg:items-center lg:justify-center'
        )}
      >
        {selectedThread ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSelectedThread(null)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <h2 className="truncate font-semibold">{selectedThread.subject}</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm">
                  <Reply className="size-4" />
                  Responder
                </Button>
                <Button variant="ghost" size="sm">
                  <ReplyAll className="size-4" />
                  Responder a todos
                </Button>
                <Button variant="ghost" size="sm">
                  <Forward className="size-4" />
                  Reenviar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Registrar como actividad</DropdownMenuItem>
                    <DropdownMenuItem>Vincular a contacto</DropdownMenuItem>
                    <DropdownMenuItem>Vincular a empresa</DropdownMenuItem>
                    <DropdownMenuItem>Vincular a oportunidad</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {selectedThread.relatedEntityName && (
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
                {(() => {
                  const Icon = getEntityIcon(
                    selectedThread.relatedEntityType ?? 'contact'
                  );
                  return (
                    <>
                      <Icon className="size-4 text-[#13944C]" />
                      <span className="text-sm font-medium">Vinculado a:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const t = selectedThread.relatedEntityType;
                          const id = selectedThread.relatedEntityId;
                          if (t === 'contact' && id) navigate(`/contactos/${id}`);
                          if (t === 'opportunity' && id) navigate(`/opportunities/${id}`);
                          if (t === 'company' && id) navigate(`/empresas/${id}`);
                        }}
                        className="text-sm text-[#13944C] hover:underline"
                      >
                        {selectedThread.relatedEntityName}
                      </button>
                      <Badge variant="secondary" className="text-[10px]">
                        {entityTypeLabels[selectedThread.relatedEntityType ?? 'contact']}
                      </Badge>
                    </>
                  );
                })()}
              </div>
            )}
            <ScrollArea className="flex-1">
              <div className="space-y-6 p-4">
                {[...selectedThread.messages].reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#13944C]/10 text-[#13944C] font-semibold">
                          {msg.fromName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{msg.fromName}</p>
                          <p className="text-xs text-muted-foreground">
                            {msg.from}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatFullDate(msg.timestamp)}
                      </span>
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-sm">
                      {msg.body}
                    </div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 rounded border bg-muted/50 px-3 py-2 text-sm"
                          >
                            <Paperclip className="size-4" />
                            {att.name}
                            <span className="text-xs text-muted-foreground">
                              ({(att.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <Inbox className="size-16 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Selecciona un correo para leerlo
            </p>
          </div>
        )}
      </div>

      {/* Mobile FAB - Compose */}
      <Button
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg lg:hidden"
        onClick={() => setComposeOpen(true)}
        style={{ backgroundColor: '#13944C' }}
      >
        <PenSquare className="size-6" />
      </Button>

      {/* Mobile/Tablet: overlay when no 3-column layout */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center gap-2 border-b p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedThread(null)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="truncate font-semibold">{selectedThread.subject}</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              {[...selectedThread.messages].reverse().map((msg) => (
                <div key={msg.id} className="rounded-lg border p-4">
                  <p className="font-medium">{msg.fromName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFullDate(msg.timestamp)}
                  </p>
                  <div className="mt-3 whitespace-pre-wrap text-sm">{msg.body}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Compose Modal */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-2xl sm:h-auto sm:max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Nuevo correo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Para</Label>
              <Input placeholder="correo@ejemplo.com" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>CC</Label>
                <Input placeholder="Opcional" />
              </div>
              <div>
                <Label>BCC</Label>
                <Input placeholder="Opcional" />
              </div>
            </div>
            <div>
              <Label>Asunto</Label>
              <Input placeholder="Asunto del correo" />
            </div>
            <div>
              <Label>Mensaje</Label>
              <Textarea
                placeholder="Escribe tu mensaje..."
                rows={8}
                className="resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button className="bg-[#13944C] hover:bg-[#0f7a3d]">
                <Send className="size-4" />
                Enviar
              </Button>
              <Button variant="outline">
                <Paperclip className="size-4" />
                Adjuntar
              </Button>
              <Button variant="outline" onClick={() => setComposeOpen(false)}>
                Guardar borrador
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
