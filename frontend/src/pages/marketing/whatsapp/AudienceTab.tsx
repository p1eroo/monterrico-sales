import { useMemo, useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  Globe,
  MessageCircle,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AvatarImage } from '@/lib/avatar';
import { ComercialInclusiveMultiFilter } from '@/components/shared/ComercialInclusiveMultiFilter';
import { cn } from '@/lib/utils';
import {
  comercialFilterIconClass,
  matchesInclusiveMultiFilterValue,
} from '@/lib/comercialFilterSurface';
import {
  crmTableBodyRowClassInteractive,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import { comercialTableCheckboxWrapClass } from '@/lib/comercialTableLayout';
import {
  WHATSAPP_PLATFORM_LABEL,
  WHATSAPP_SOURCE_LABEL,
  type WhatsAppContact,
  type WhatsAppContactSource,
} from './mockData';

const SOURCE_OPTIONS = (Object.keys(WHATSAPP_SOURCE_LABEL) as WhatsAppContactSource[]).map(
  (value) => ({ value, label: WHATSAPP_SOURCE_LABEL[value] }),
);

const PLATFORM_OPTIONS = ['fb', 'ig', 'msg', 'an'].map((value) => ({
  value,
  label: WHATSAPP_PLATFORM_LABEL[value],
}));

function platformBadgeClass(platform?: string) {
  if (platform === 'ig') {
    return 'border-pink-300/60 bg-pink-50 text-pink-800 dark:border-pink-700 dark:bg-pink-950/40 dark:text-pink-200';
  }
  if (platform === 'fb') {
    return 'border-blue-300/60 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
  }
  return 'border-border bg-muted text-muted-foreground';
}

export function AudienceTab({
  contacts,
  selectedIds,
  onToggleSelect,
  onAddAll,
  onRemoveIds,
  onImportExcel,
}: {
  contacts: WhatsAppContact[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onAddAll: () => void;
  onRemoveIds: (ids: string[]) => void;
  onImportExcel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);

  const hasActiveFilters =
    Boolean(search.trim()) || sourceFilter.length > 0 || platformFilter.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!matchesInclusiveMultiFilterValue(sourceFilter, c.source)) return false;
      if (!matchesInclusiveMultiFilterValue(platformFilter, c.platform)) return false;
      if (q) {
        const hay = `${c.name} ${c.phone} ${c.company ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, sourceFilter, platformFilter]);

  const selected = contacts.filter((c) => selectedIds.has(c.id));
  const notYetAdded = contacts.filter((c) => !selectedIds.has(c.id));
  const withWhatsAppSelected = selected.filter((c) => c.hasWhatsApp).length;

  const clearFilters = () => {
    setSearch('');
    setSourceFilter([]);
    setPlatformFilter([]);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_420px]">
      {/* Selector de contactos */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex min-w-0 flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center">
          <div className="relative w-full min-w-0 max-w-[340px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
            <Input
              placeholder="Buscar nombre, teléfono o empresa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-8 text-[13px] text-black shadow-none placeholder:text-[#8a9aab] transition-colors hover:border-primary focus-visible:ring-1 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
          </div>
          <ComercialInclusiveMultiFilter
            value={sourceFilter}
            onChange={setSourceFilter}
            options={SOURCE_OPTIONS}
            placeholder="Origen"
            countLabel="orígenes"
            icon={<Database className={comercialFilterIconClass} />}
          />
          <ComercialInclusiveMultiFilter
            value={platformFilter}
            onChange={setPlatformFilter}
            options={PLATFORM_OPTIONS}
            placeholder="Plataforma"
            countLabel="plataformas"
            icon={<Globe className={comercialFilterIconClass} />}
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" /> Limpiar
            </Button>
          )}
          <Button variant="outline" size="sm" className="ml-auto h-9" onClick={onImportExcel}>
            <FileSpreadsheet className="size-4" />
            Importar Excel
          </Button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allFilteredSelected}
              onCheckedChange={(v) => {
                const all = allFilteredSelected;
                filtered.forEach((c) => onToggleSelect(c.id, !all && Boolean(v)));
              }}
            />
            <p className="text-sm">
              <span className="font-semibold">{filtered.length}</span>{' '}
              <span className="text-muted-foreground">coincidencias</span>
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 bg-[#13944C] hover:bg-[#0f7a3d]"
            disabled={notYetAdded.length === 0}
            onClick={onAddAll}
          >
            Agregar todos ({notYetAdded.length})
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Users className="size-8 text-muted-foreground/40" />
            <p className="text-sm">No hay contactos con estos filtros.</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-330px)] overflow-auto border-t border-border/40 scrollbar-thin">
            <table className="w-full table-fixed bg-transparent">
              <thead>
                <tr className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                  <th className="w-11 px-2">
                    <div className={comercialTableCheckboxWrapClass}>
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={(v) => {
                          const all = allFilteredSelected;
                          filtered.forEach((c) => onToggleSelect(c.id, !all && Boolean(v)));
                        }}
                        className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />
                    </div>
                  </th>
                  <th className="px-3 text-[11px] font-bold">Contacto</th>
                  <th className="px-3 text-[11px] font-bold">Origen</th>
                  <th className="px-3 text-[11px] font-bold">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={cn('h-[52px] last:border-b-0', crmTableBodyRowClassInteractive)}
                      onClick={() => onToggleSelect(c.id, !isSelected)}
                    >
                      <td className="px-2" onClick={(e) => e.stopPropagation()}>
                        <div className={comercialTableCheckboxWrapClass}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => onToggleSelect(c.id, Boolean(v))}
                            className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                          />
                        </div>
                      </td>
                      <td className="overflow-hidden px-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 overflow-hidden rounded-full">
                            <AvatarImage name={c.name} size={36} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100">
                              {c.name}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              +51 {c.phone}
                            </p>
                            {c.company && (
                              <p className="truncate text-[11px] text-muted-foreground/80">{c.company}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="overflow-hidden px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="h-5 rounded-full text-[10px] font-medium">
                            {WHATSAPP_SOURCE_LABEL[c.source]}
                          </Badge>
                          {c.platform && (
                            <Badge
                              variant="outline"
                              className={cn('h-5 rounded-full text-[10px] font-medium', platformBadgeClass(c.platform))}
                            >
                              {WHATSAPP_PLATFORM_LABEL[c.platform]}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="overflow-hidden px-3">
                        {c.hasWhatsApp ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                            <MessageCircle className="size-3.5" />
                            Activo
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className="inline-flex h-5 items-center gap-1 rounded-full text-[10px] font-medium text-muted-foreground"
                          >
                            <MessageCircle className="size-3" />
                            Sin WhatsApp
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Seleccionados */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">
              En este envío
              <Badge variant="secondary" className="ml-2 align-middle">
                {selected.length}
              </Badge>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {withWhatsAppSelected} con WhatsApp · {selected.length - withWhatsAppSelected} sin WhatsApp
            </p>
          </div>
          {selected.length > 0 && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => onRemoveIds(selected.map((c) => c.id))}>
              <Trash2 className="size-3.5" />
              Quitar todos
            </Button>
          )}
        </div>

        {selected.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageCircle className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">Sin contactos seleccionados</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Agrega contactos de la izquierda o importa un Excel para armar la audiencia.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            {selected.map((c) => (
              <div key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                <span className="flex size-8 shrink-0 overflow-hidden rounded-full">
                  <AvatarImage name={c.name} size={32} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{c.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">+51 {c.phone}</p>
                </div>
                {!c.hasWhatsApp && (
                  <Badge variant="outline" className="h-5 shrink-0 rounded-full text-[10px] text-muted-foreground">
                    Sin WhatsApp
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  onClick={() => onRemoveIds([c.id])}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
