import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { fetchMasivoProspectos, type FlotaMasivoProspecto } from '@/lib/flotaWhatsappApi';
import { flotaProspectosCounts } from '@/lib/flotaProspectosApi';
import { FLOTA_PROSPECTO_ESTADOS, formatProspectoEstado, prospectoEstadoLabel } from './prospectoEstado';
import { ChatpoolAvatar } from './ui/Avatar';
import { ChatpoolLabelChip } from './ui/LabelChip';
import { ConductorCodigoBadge } from './ui/ConductorCodigoBadge';
import { useChatpoolStore } from './store';
import { phoneKey, getConductorCodigo } from './utils';

function prospectPhone(prospecto: FlotaMasivoProspecto): string {
  return (prospecto.celular || prospecto.movil || '').trim();
}

function groupProspects(items: FlotaMasivoProspecto[]): { key: string; items: FlotaMasivoProspecto[] }[] {
  const groups = new Map<string, FlotaMasivoProspecto[]>();
  for (const item of items) {
    const name = item.nombreCompleto?.trim() || prospectPhone(item) || '?';
    const key = name.charAt(0).toUpperCase();
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([key, groupItems]) => ({ key, items: groupItems }));
}

export function ProspectList() {
  const connectionState = useChatpoolStore((s) => s.connectionState);
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const filterEstado = useChatpoolStore((s) => s.filterEstado);
  const setFilterEstado = useChatpoolStore((s) => s.setFilterEstado);
  const conductorCodigoByPhone = useChatpoolStore((s) => s.conductorCodigoByPhone);
  const openProspectoConversation = useChatpoolStore((s) => s.openProspectoConversation);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [prospects, setProspects] = useState<FlotaMasivoProspecto[]>([]);
  const [estadoCounts, setEstadoCounts] = useState<Record<string, number>>({});
  const [totalProspectos, setTotalProspectos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connectionState !== 'ready') return;
    void flotaProspectosCounts()
      .then((counts) => {
        setEstadoCounts(counts.estadoCounts ?? {});
        setTotalProspectos(counts.total ?? 0);
      })
      .catch(() => {});
  }, [connectionState]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadProspects = useCallback(async (query: string, estado: string | null, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMasivoProspectos(query || undefined, estado ?? undefined);
      if (signal.aborted) return;
      setProspects(data);
    } catch (e) {
      if (signal.aborted) return;
      setProspects([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los prospectos');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connectionState !== 'ready') return;
    const controller = new AbortController();
    void loadProspects(debouncedSearch, filterEstado, controller.signal);
    return () => controller.abort();
  }, [connectionState, debouncedSearch, filterEstado, loadProspects]);

  const grouped = useMemo(() => groupProspects(prospects), [prospects]);
  const isReady = connectionState === 'ready';

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar contactos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted/50 border-transparent focus-visible:border-primary"
        />
      </div>

      <div className="mb-2">
        <Select
          value={filterEstado ?? '__all__'}
          onValueChange={(value) => setFilterEstado(value === '__all__' ? null : value)}
        >
          <SelectTrigger className="h-9 bg-muted/50 border-transparent text-xs">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los estados ({totalProspectos || prospects.length})</SelectItem>
            {FLOTA_PROSPECTO_ESTADOS.map((estado) => (
              <SelectItem key={estado} value={estado}>
                {formatProspectoEstado(estado)} ({estadoCounts[estado] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-b border-border" />

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
        {!isReady ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Users className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm font-medium">Contactos no disponibles</p>
          </div>
        ) : loading && prospects.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando contactos…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-muted-foreground text-sm font-medium">{error}</p>
          </div>
        ) : prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Users className="w-12 h-12 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm font-medium">Sin contactos</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              {debouncedSearch
                ? 'Prueba con otro término de búsqueda'
                : filterEstado
                  ? `No hay prospectos en estado ${formatProspectoEstado(filterEstado)}`
                  : 'No hay prospectos en el CRM'}
            </p>
          </div>
        ) : (
          grouped.map(({ key, items }) => (
            <div key={key}>
              <div className="sticky top-0 z-[1] bg-card/95 backdrop-blur px-4 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
                {key}
              </div>
              {items.map((prospecto) => {
                const phone = prospectPhone(prospecto);
                const hasPhone = phoneKey(phone).length >= 8;
                const isActive = activeConversationId === prospecto.id;
                const estadoLabel = prospecto.estado ? formatProspectoEstado(prospecto.estado) : null;
                const conductorCodigo = getConductorCodigo(phone, conductorCodigoByPhone);

                return (
                  <button
                    key={prospecto.id}
                    type="button"
                    disabled={!hasPhone}
                    onClick={() => void openProspectoConversation(prospecto)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/40',
                      hasPhone ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-50 cursor-not-allowed',
                      isActive && 'bg-primary/5 border-l-2 border-l-primary pl-[14px]',
                    )}
                  >
                    <ChatpoolAvatar name={prospecto.nombreCompleto} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {prospecto.nombreCompleto?.trim() || 'Sin nombre'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground mt-0.5">
                        {hasPhone ? phone : 'Sin teléfono'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {conductorCodigo ? <ConductorCodigoBadge codigo={conductorCodigo} /> : null}
                        {estadoLabel ? (
                          <ChatpoolLabelChip label={prospectoEstadoLabel(prospecto.id, prospecto.estado!)} />
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
