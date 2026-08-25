import { useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { CampaignRecipient } from '@/types';
import { AvatarImage } from '@/lib/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { IMPORT_SPREADSHEET_ACCEPT } from '@/lib/importSpreadsheet';
import type {
  CampaignAudienceFilters,
  CampaignAudienceSource,
} from '@/lib/campaignAudience';

type CampaignAudienceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canImport: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  source: CampaignAudienceSource;
  filters: CampaignAudienceFilters;
  onFiltersChange: (next: CampaignAudienceFilters) => void;
  candidates: CampaignRecipient[];
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
  recipients: CampaignRecipient[];
  selectedIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  onAdd: (ids: string[]) => void;
  onRemoveIds: (ids: string[]) => void;
  duplicateCount: number;
  invalidIds: Set<string>;
};

function sameContact(a: CampaignRecipient, b: CampaignRecipient) {
  return (
    a.id === b.id ||
    (Boolean(a.contactId) && a.contactId === b.contactId) ||
    (Boolean(a.email) && a.email.toLowerCase() === b.email.toLowerCase())
  );
}

function CandidatePickerList({
  candidates,
  recipients,
  onAdd,
}: {
  candidates: CampaignRecipient[];
  recipients: CampaignRecipient[];
  onAdd: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const c = candidates[item.index];
          const isAdded = recipients.some((r) => sameContact(r, c));
          const noEmail = !c.email;
          return (
            <div
              key={c.id}
              className="absolute top-0 left-0 w-full px-2"
              style={{
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <button
                type="button"
                disabled={isAdded || noEmail}
                onClick={() => onAdd(c.id)}
                className={cn(
                  'flex h-[68px] w-full items-center gap-3 rounded-lg px-2 text-left transition-colors',
                  isAdded
                    ? 'bg-[#13944C]/8'
                    : noEmail
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-muted/70',
                )}
              >
                <span className="flex size-9 shrink-0 overflow-hidden rounded-full">
                  <AvatarImage name={c.name} size={36} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {c.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {c.email || 'Sin email'}
                  </span>
                  {c.company ? (
                    <span className="block truncate text-xs text-muted-foreground/80">
                      {c.company}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    isAdded
                      ? 'bg-[#13944C] text-white'
                      : 'border border-border text-muted-foreground',
                  )}
                >
                  {isAdded ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CampaignAudienceSheet({
  open,
  onOpenChange,
  canImport,
  fileInputRef,
  onFileChange,
  source,
  filters,
  onFiltersChange,
  candidates,
  loading = false,
  error = null,
  retry,
  recipients,
  selectedIds,
  onToggleSelectAll,
  onToggleSelect,
  onAdd,
  onRemoveIds,
  duplicateCount,
  invalidIds,
}: CampaignAudienceSheetProps) {
  const [sourceTab, setSourceTab] = useState<'pick' | 'excel'>('pick');
  const notYetAdded = candidates.filter(
    (c) => Boolean(c.email) && !recipients.some((r) => sameContact(r, c)),
  );
  const hasFilters = Object.values(filters).some((v) => String(v ?? '').trim());
  const countLabel = candidates.length.toLocaleString('es-PE');

  const setFilter = (key: string, value: string) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSourceTab('pick');
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <SheetTitle>Destinatarios</SheetTitle>
          <SheetDescription>{source.sheetDescription}</SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[380px_1fr]">
          <aside className="flex min-h-0 flex-col border-r bg-muted/20">
            {canImport && (
              <div className="shrink-0 border-b px-4 py-3">
                <Tabs
                  value={sourceTab}
                  onValueChange={(v) => setSourceTab(v as 'pick' | 'excel')}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pick">
                      <Users className="size-3.5" />
                      {source.sourceLabel}
                    </TabsTrigger>
                    <TabsTrigger value="excel">
                      <FileSpreadsheet className="size-3.5" />
                      Excel
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {sourceTab === 'excel' && canImport ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMPORT_SPREADSHEET_ACCEPT}
                  className="sr-only"
                  onChange={onFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full max-w-sm flex-col items-center rounded-xl border border-dashed bg-background px-6 py-10 text-center transition-colors hover:border-[#13944C]/50 hover:bg-[#13944C]/5"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Upload className="size-5 text-muted-foreground" />
                  </span>
                  <p className="mt-3 text-sm font-medium">Importar Excel</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Columnas requeridas: <span className="font-medium">nombre</span> y{' '}
                    <span className="font-medium">email</span>
                  </p>
                </button>
              </div>
            ) : (
              <>
                <div className="shrink-0 space-y-2 border-b px-4 py-3">
                  {source.filterControls.map((control) => {
                    if (control.type === 'search') {
                      return (
                        <div key={control.key} className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={control.placeholder}
                            value={filters[control.key] ?? ''}
                            onChange={(e) => setFilter(control.key, e.target.value)}
                            className="h-9 bg-background pl-8"
                          />
                        </div>
                      );
                    }
                    if (control.type === 'select') {
                      return (
                        <Select
                          key={control.key}
                          value={filters[control.key] || 'all'}
                          onValueChange={(v) =>
                            setFilter(control.key, v === 'all' ? '' : v)
                          }
                        >
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder={control.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{control.placeholder}</SelectItem>
                            {control.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }
                    const Icon = control.icon;
                    return (
                      <div key={control.key} className="relative">
                        <Icon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder={control.placeholder}
                          value={filters[control.key] ?? ''}
                          onChange={(e) => setFilter(control.key, e.target.value)}
                          className="h-9 bg-background pl-8"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {source.pickerHeaderLabel}
                    </p>
                    <p className="text-sm font-medium">
                      {loading ? 'Cargando…' : `${countLabel} coincidencias`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 shrink-0 bg-[#13944C] hover:bg-[#0f7a3d]"
                    disabled={loading || Boolean(error) || notYetAdded.length === 0}
                    onClick={() => onAdd(notYetAdded.map((c) => c.id))}
                  >
                    <Plus className="size-3.5" />
                    {hasFilters ? `Agregar ${notYetAdded.length}` : 'Agregar todos'}
                  </Button>
                </div>

                {loading ? (
                  <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando…
                  </div>
                ) : error ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                    <p className="text-sm text-destructive">{error}</p>
                    {retry && (
                      <Button type="button" variant="outline" size="sm" onClick={retry}>
                        Reintentar
                      </Button>
                    )}
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                    <Users className="size-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {source.emptyStateTitle}
                    </p>
                    {source.emptyStateDescription && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {source.emptyStateDescription}
                      </p>
                    )}
                  </div>
                ) : (
                  <CandidatePickerList
                    candidates={candidates}
                    recipients={recipients}
                    onAdd={(id) => onAdd([id])}
                  />
                )}
              </>
            )}
          </aside>

          <section className="flex min-h-0 flex-col bg-background">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
              <div>
                <p className="text-sm font-semibold">
                  En esta campaña
                  <Badge variant="secondary" className="ml-2 align-middle">
                    {recipients.length}
                  </Badge>
                </p>
                {(duplicateCount > 0 || invalidIds.size > 0) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {duplicateCount > 0 && `${duplicateCount} duplicados`}
                    {duplicateCount > 0 && invalidIds.size > 0 && ' · '}
                    {invalidIds.size > 0 && `${invalidIds.size} emails inválidos`}
                  </p>
                )}
              </div>
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onRemoveIds([...selectedIds])}
                >
                  <Trash2 className="size-3.5" />
                  Quitar ({selectedIds.size})
                </Button>
              )}
            </div>

            {(duplicateCount > 0 || invalidIds.size > 0) && (
              <div className="flex flex-wrap gap-2 border-b px-5 py-2">
                {duplicateCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="size-3" />
                    Duplicados
                  </Badge>
                )}
                {invalidIds.size > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" />
                    Emails inválidos
                  </Badge>
                )}
              </div>
            )}

            {recipients.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <Users className="size-6 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">Sin destinatarios</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Agrega {source.pickerHeaderLabel.toLowerCase()} a la izquierda o
                  importa un Excel.
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pl-5">
                        <Checkbox
                          checked={
                            recipients.length > 0 && selectedIds.size === recipients.length
                          }
                          onCheckedChange={onToggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="hidden md:table-cell">Empresa</TableHead>
                      <TableHead className="w-10 pr-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.id} className="group">
                        <TableCell className="pl-5">
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={(c) => onToggleSelect(r.id, Boolean(c))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 overflow-hidden rounded-full">
                              <AvatarImage name={r.name} size={32} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{r.name}</p>
                              <p
                                className={cn(
                                  'truncate text-xs text-muted-foreground',
                                  invalidIds.has(r.id) && 'text-destructive',
                                )}
                              >
                                {r.email || 'Sin email'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[180px] truncate text-muted-foreground md:table-cell">
                          {r.company ?? '—'}
                        </TableCell>
                        <TableCell className="pr-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => onRemoveIds([r.id])}
                            aria-label={`Quitar a ${r.name}`}
                          >
                            <X className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex shrink-0 items-center justify-end border-t px-5 py-3">
              <Button
                className="bg-[#13944C] hover:bg-[#0f7a3d]"
                onClick={() => onOpenChange(false)}
              >
                Listo
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
