import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, Building2, ChevronLeft, ChevronRight, Loader2, Check, Bookmark, Trash2, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { apolloSearch, apolloCompaniesSearch, apolloEnrichPerson, batchCheckCompanies, type ApolloPerson, type ApolloCompany } from '@/lib/apolloApi';
import { contactCreate } from '@/lib/contactApi';
import { loadSavedSearches, saveSearch, removeSavedSearch, type SavedSearch } from '@/lib/savedSearches';

interface DisplayRow {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  location: string;
}

export default function ApolloPage() {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiResults, setApiResults] = useState<ApolloPerson[] | null>(null);
  const [apiTotal, setApiTotal] = useState(0);
  const [usingMock, setUsingMock] = useState(true);
  const [activeTab, setActiveTab] = useState<'personas' | 'empresas' | 'listas'>('personas');
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [emailStatus, setEmailStatus] = useState<string>('all');
  const [jobTitleFilters, setJobTitleFilters] = useState<string[]>([]);
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [suggestedCompanies, setSuggestedCompanies] = useState<string[]>([]);
  const [suggestedLocations, setSuggestedLocations] = useState<string[]>([]);
  const [companyFilters, setCompanyFilters] = useState<string[]>([]);
  const [companyInput, setCompanyInput] = useState('');
  const [employeeMin, setEmployeeMin] = useState('');
  const [employeeMax, setEmployeeMax] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [companyCheckOpen, setCompanyCheckOpen] = useState(false);
  const [companyCheckResults, setCompanyCheckResults] = useState<{ name: string; companyId: string; matchedBy: string }[]>([]);
  const [companyCheckResolve, setCompanyCheckResolve] = useState<(() => void) | null>(null);
  const [enrichedPersons, setEnrichedPersons] = useState<Record<string, { name?: string; email: string; phone: string; linkedin_url: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('apollo-enriched') || '{}'); } catch { return {}; }
  });
  const [searchParams] = useSearchParams();
  const perPage = 25;

  // Load search params from URL + auto-search
  useEffect(() => {
    const tab = searchParams.get('tab');
    const q = searchParams.get('query');
    const title = searchParams.get('title');
    const company = searchParams.get('company');
    const industry = searchParams.get('industry');
    const location = searchParams.get('location');
    if (!q && !title && !company && !industry && !location) return;

    if (tab === 'empresas') {
      setActiveTab('empresas');
      setCompaniesQuery(q || '');
    } else {
      setActiveTab('personas');
      setQuery(q || '');
      setIndustryFilter(industry || '');
      setLocationFilter(location ? [location] : []);
      if (title) setJobTitleFilters(title.split(',').map((t) => t.trim()).filter(Boolean));
      if (company) setCompanyFilters(company.split(',').map((c) => c.trim()).filter(Boolean));
    }

    // Try loading from cache first
    const cacheKey = tab === 'empresas'
      ? `apollo-cache:${encodeURIComponent(`${q || ''}|||||||1`)}`
      : `apollo-cache:${encodeURIComponent(`${q || ''}|${industry || ''}|${location ? [location].join() : ''}|${title ? title.split(',').join() : ''}|${company ? company.split(',').join() : ''}|all|||1`)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setApiResults(data.results);
        setApiTotal(data.total);
        setUsingMock(false);
        setPage(1);
      } catch { /* ignore */ }
    } else {
      // No cache → auto-search (AI already spent credits)
      setLoading(true);
      if (tab === 'empresas') {
        setTimeout(() => void handleCompaniesSearch(), 100);
      } else {
        setTimeout(() => void handleApiSearch(), 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save search when arriving with ?save=true from AI assistant

  // Auto-save search when arriving with ?save=true from AI assistant
  useEffect(() => {
    if (searchParams.get('save') !== 'true') return;
    const tab = searchParams.get('tab') || 'personas';
    const q = searchParams.get('query') || '';
    const name = q ? `AI: ${q}` : `Búsqueda desde asistente`;
    setTimeout(() => {
      const updated = saveSearch({ name, type: tab === 'empresas' ? 'empresas' : 'personas', query: q || undefined });
      setSavedSearches(updated);
      toast.success(`Búsqueda guardada como "${name}"`);
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('apollo-enriched', JSON.stringify(enrichedPersons));
  }, [enrichedPersons]);

  // Empresas state
  const [companiesQuery, setCompaniesQuery] = useState('');
  const [companiesResults, setCompaniesResults] = useState<ApolloCompany[] | null>(null);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [empresasFilterOpen, setEmpresasFilterOpen] = useState(true);
  const [empresasIndustry, setEmpresasIndustry] = useState('');
  const [empresasLocation, setEmpresasLocation] = useState<string[]>([]);
  const [empresasLocationInput, setEmpresasLocationInput] = useState('');
  const [empresasEmployeeMin, setEmpresasEmployeeMin] = useState('');
  const [empresasEmployeeMax, setEmpresasEmployeeMax] = useState('');

  const dataSource = useMemo(() => {
    if (apiResults) return apiResults.map((p) => ({
      id: p.id,
      name: p.name || '',
      title: p.title || '',
      email: p.email || '',
      phone: p.phone || '',
      company: p.organization?.name || '',
      industry: p.organization?.industry || '',
      location: [p.organization?.location?.city, p.organization?.location?.country].filter(Boolean).join(', '),
    }));
    return [];
  }, [apiResults]);

  const filteredResults = useMemo(() => {
    const source = usingMock ? [] : dataSource;
    return source.filter((r) => {
      if (industryFilter && !r.industry.toLowerCase().includes(industryFilter.toLowerCase())) return false;
      if (locationFilter.length > 0 && !locationFilter.some((l) => r.location.toLowerCase().includes(l.toLowerCase()))) return false;
      return true;
    });
  }, [industryFilter, locationFilter, dataSource, usingMock]);

  const totalPages = Math.ceil(filteredResults.length / perPage);
  const paginatedResults = filteredResults.slice((page - 1) * perPage, page * perPage);

  function searchCacheKey(pageNum: number) {
    const raw = `${query}|${industryFilter}|${locationFilter.join()}|${jobTitleFilters.join()}|${companyFilters.join()}|${emailStatus}|${employeeMin}|${employeeMax}|${pageNum}`;
    return `apollo-cache:${encodeURIComponent(raw)}`;
  }

  async function handleApiSearch(newPage = 1) {
    const cacheKey = searchCacheKey(newPage);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setApiResults(data.results);
        setApiTotal(data.total);
        setPage(newPage);
        return;
      } catch { /* ignore cache error */ }
    }

    setLoading(true);
    setError('');
    try {
      const res = await apolloSearch({
        query: query || undefined,
        industry: industryFilter || undefined,
        location: locationFilter.length > 0 ? locationFilter.join(',') : undefined,
        title: jobTitleFilters.length > 0 ? jobTitleFilters.join(',') : undefined,
        company: companyFilters.length > 0 ? companyFilters.join(',') : undefined,
        emailStatus: emailStatus !== 'all' ? emailStatus : undefined,
        employeeMin: employeeMin || undefined,
        employeeMax: employeeMax || undefined,
        page: newPage,
      });
      localStorage.setItem(cacheKey, JSON.stringify({ results: res.results, total: res.total }));
      setApiResults(res.results);
      setApiTotal(res.total);
      setUsingMock(false);
      setPage(newPage);
      const titles = [...new Set(res.results.map((p) => p.title).filter(Boolean))] as string[];
      setSuggestedTitles((prev) => [...new Set([...prev, ...titles])].sort());
      const companies = [...new Set(res.results.map((p) => p.organization?.name).filter(Boolean))] as string[];
      setSuggestedCompanies((prev) => [...new Set([...prev, ...companies])].sort());
      const locations = [...new Set(res.results.map((p) => [p.organization?.location?.city, p.organization?.location?.country].filter(Boolean).join(', ')).filter(Boolean))] as string[];
      setSuggestedLocations((prev) => [...new Set([...prev, ...locations])].sort());
    } catch (e) {
      setApiResults(null);
      setUsingMock(true);
      setError(e instanceof Error ? e.message : 'Error al buscar en Apollo');
    } finally {
      setLoading(false);
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === paginatedResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedResults.map((r) => r.id)));
    }
  };

  const selectedRows = useMemo(() => {
    return dataSource.filter((r) => selectedIds.has(r.id));
  }, [selectedIds, dataSource]);

  async function handleImport() {
    if (selectedRows.length === 0) return;

    // Check companies before importing
    const companyMap = new Map<string, { name: string; domain?: string }>();
    for (const row of selectedRows) {
      if (!row.company) continue;
      if (companyMap.has(row.company)) continue;
      const enriched = enrichedPersons[row.id];
      const domain = enriched?.email ? enriched.email.split('@')[1] : row.email ? row.email.split('@')[1] : undefined;
      companyMap.set(row.company, { name: row.company, domain });
    }
    const items = Array.from(companyMap.values());
    let existingCompanies: { name: string; companyId: string; matchedBy: string }[] = [];
    if (items.length > 0) {
      try {
        const res = await batchCheckCompanies(items);
        existingCompanies = res.results;
      } catch { /* si falla, continuar sin validación */ }
    }

    if (existingCompanies.length > 0) {
      setCompanyCheckResults(existingCompanies);
      setCompanyCheckOpen(true);
      setCompanyCheckResolve(() => async () => {
        setCompanyCheckOpen(false);
        await executeImport(existingCompanies);
      });
      return;
    }

    await executeImport([]);
  }

  async function executeImport(existingCompanies: { name: string; companyId: string }[]) {
    const existingMap = new Map(existingCompanies.map((c) => [c.name, c.companyId]));
    setImporting(true);
    let success = 0;
    let failed = 0;
    for (const row of selectedRows) {
      try {
        const enriched = enrichedPersons[row.id];
        const companyId = row.company ? existingMap.get(row.company) : undefined;
        await contactCreate({
          name: enriched?.name || row.name,
          correo: enriched?.email || row.email || undefined,
          telefono: enriched?.phone || row.phone || undefined,
          cargo: row.title || undefined,
          fuente: 'apollo',
          etapa: 'lead',
          companyId: companyId || undefined,
          newCompany: row.company && !companyId
            ? { name: row.company }
            : undefined,
        });
        success++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setImportDialogOpen(false);
    if (failed === 0) {
      toast.success(`${success} contacto${success !== 1 ? 's' : ''} importado${success !== 1 ? 's' : ''} correctamente`);
    } else {
      toast.error(`${success} importados, ${failed} fallaron`);
    }
    setSelectedIds(new Set());
  }

  async function handleEnrich(personId: string) {
    if (enrichedPersons[personId]) return;
    try {
      const data = await apolloEnrichPerson(personId);
      setEnrichedPersons((prev) => ({
        ...prev,
        [personId]: { name: data.name, email: data.email, phone: data.phone, linkedin_url: data.linkedin_url },
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al desbloquear contacto');
    }
  }

  async function handleCompaniesSearch() {
    setCompaniesLoading(true);
    setCompaniesError('');
    try {
      const res = await apolloCompaniesSearch({ query: companiesQuery || undefined });
      setCompaniesResults(res.results);
      setCompaniesTotal(res.total);
      setUsingMock(false);
    } catch (e) {
      setCompaniesResults(null);
      setCompaniesError(e instanceof Error ? e.message : 'Error al buscar empresas');
    } finally {
      setCompaniesLoading(false);
    }
  }

  const selectedCompanies = useMemo(() => {
    if (!companiesResults) return [];
    return companiesResults.filter((r) => selectedCompanyIds.has(r.id));
  }, [selectedCompanyIds, companiesResults]);

  useEffect(() => { setSavedSearches(loadSavedSearches()); }, []);

  function handleApplySearch(s: SavedSearch) {
    if (s.type === 'personas') {
      setQuery(s.query || '');
      setIndustryFilter(s.industry || '');
      setLocationFilter(s.location ? s.location.split(',').map((l) => l.trim()).filter(Boolean) : []);
      setActiveTab('personas');
      setTimeout(() => void handleApiSearch(), 0);
    } else {
      setCompaniesQuery(s.query || '');
      setActiveTab('empresas');
      setTimeout(() => void handleCompaniesSearch(), 0);
    }
  }

  function handleSaveCurrent() {
    const name = saveName.trim();
    if (!name) { toast.error('Ingresa un nombre'); return; }
    const base: Omit<SavedSearch, 'id' | 'createdAt'> = {
      name,
      type: activeTab === 'empresas' ? 'empresas' : 'personas',
      query: activeTab === 'empresas' ? companiesQuery : query,
      industry: activeTab === 'personas' ? industryFilter : undefined,
      location: activeTab === 'personas' ? (locationFilter.length > 0 ? locationFilter.join(', ') : undefined) : undefined,
    };
    const updated = saveSearch(base);
    setSavedSearches(updated);
    setSaveDialogOpen(false);
    setSaveName('');
    toast.success('Búsqueda guardada');
  }

  function handleDeleteSearch(id: string) {
    const updated = removeSavedSearch(id);
    setSavedSearches(updated);
  }

  function searchesForCurrentTab() {
    const t = activeTab === 'empresas' ? 'empresas' : 'personas';
    return savedSearches.filter((s) => s.type === t);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs */}
      <div className="flex gap-6 mb-6">
        {(['personas', 'empresas', 'listas'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab ? 'bg-[#13944C]/10 text-[#13944C]' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab === 'personas' ? 'Personas' : tab === 'empresas' ? 'Empresas' : 'Listas'}
          </button>
        ))}
      </div>

      {activeTab === 'personas' && (
        <div className="flex flex-col flex-1 min-h-0 space-y-6">
      {/* Search + Filters row */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5 h-9 shadow-none">
              <Bookmark className="size-4" /> Búsquedas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => { setSaveDialogOpen(true); setSaveName(''); }}>
              <Plus className="size-3.5" /> Guardar búsqueda actual
            </DropdownMenuItem>
            {searchesForCurrentTab().length > 0 && <DropdownMenuSeparator />}
            {searchesForCurrentTab().map((s) => (
              <div key={s.id} className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-muted cursor-pointer" onClick={() => handleApplySearch(s)}>
                <Bookmark className="size-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{s.name}</span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSearch(s.id); }} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
            {searchesForCurrentTab().length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">Sin búsquedas guardadas</p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" className="gap-1.5 h-9 shadow-none" onClick={() => setFilterPanelOpen(!filterPanelOpen)}>
          <SlidersHorizontal className="size-4" /> Filtros
        </Button>
        <div className="relative flex-1 min-w-[300px] max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, empresa, cargo..."
            className="pl-9 shadow-none"
             onKeyDown={(e) => e.key === 'Enter' && void handleApiSearch()} />
          </div>
        <div className="flex items-center gap-2 ml-auto">
           <Button size="sm" disabled={selectedIds.size === 0} className="gap-1.5" onClick={() => setImportDialogOpen(true)}>
             <Download className="size-3.5" /> Importar ({selectedIds.size})
           </Button>
         </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Table + Filter panel */}
      <div className="flex gap-4 flex-1 min-h-0">
        {filterPanelOpen && (
          <div className="w-72 shrink-0 self-start space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filtros</p>
              <button onClick={() => setFilterPanelOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cerrar</button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado de email</Label>
              <Select value={emailStatus} onValueChange={setEmailStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="verified">Verificado</SelectItem>
                  <SelectItem value="unverified">No verificado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Puesto de trabajo</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {jobTitleFilters.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md bg-[#13944C]/10 px-2 py-0.5 text-xs text-[#13944C]">
                    {t}
                    <button onClick={() => setJobTitleFilters((prev) => prev.filter((x) => x !== t))} className="hover:text-destructive">&times;</button>
                  </span>
                ))}
              </div>
              <Input
                value={jobTitleInput}
                onChange={(e) => setJobTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && jobTitleInput.trim()) {
                    e.preventDefault();
                    setJobTitleFilters((prev) => [...prev, jobTitleInput.trim()]);
                    setJobTitleInput('');
                  }
                }}
                placeholder="Ej: CEO, Gerente..."
                className="h-8 text-xs shadow-none"
                list="job-titles-list"
              />
              <datalist id="job-titles-list">
                {suggestedTitles.filter((t) => t.toLowerCase().includes(jobTitleInput.toLowerCase())).slice(0, 10).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {companyFilters.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md bg-[#13944C]/10 px-2 py-0.5 text-xs text-[#13944C]">
                    {t}
                    <button onClick={() => setCompanyFilters((prev) => prev.filter((x) => x !== t))} className="hover:text-destructive">&times;</button>
                  </span>
                ))}
              </div>
              <Input
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && companyInput.trim()) {
                    e.preventDefault();
                    setCompanyFilters((prev) => [...prev, companyInput.trim()]);
                    setCompanyInput('');
                  }
                }}
                placeholder="Nombre de empresa..."
                className="h-8 text-xs shadow-none"
                list="companies-list"
              />
              <datalist id="companies-list">
                {suggestedCompanies.filter((c) => c.toLowerCase().includes(companyInput.toLowerCase())).slice(0, 10).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ubicación</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {locationFilter.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 rounded-md bg-[#13944C]/10 px-2 py-0.5 text-xs text-[#13944C]">
                    {l}
                    <button onClick={() => setLocationFilter((prev) => prev.filter((x) => x !== l))} className="hover:text-destructive">&times;</button>
                  </span>
                ))}
              </div>
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && locationInput.trim()) {
                    e.preventDefault();
                    setLocationFilter((prev) => [...prev, locationInput.trim()]);
                    setLocationInput('');
                  }
                }}
                placeholder="Ciudad, país..."
                className="h-8 text-xs shadow-none"
                list="locations-list"
              />
              <datalist id="locations-list">
                {suggestedLocations.filter((l) => l.toLowerCase().includes(locationInput.toLowerCase())).slice(0, 10).map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Empleados</Label>
              <div className="flex items-center gap-2">
                <Input value={employeeMin} onChange={(e) => setEmployeeMin(e.target.value)} placeholder="Mín" className="h-8 text-xs shadow-none w-full" type="number" />
                <span className="text-xs text-muted-foreground">-</span>
                <Input value={employeeMax} onChange={(e) => setEmployeeMax(e.target.value)} placeholder="Máx" className="h-8 text-xs shadow-none w-full" type="number" />
              </div>
            </div>

            <Button size="sm" className="w-full" onClick={() => void handleApiSearch()}>
              Aplicar filtros
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-auto max-h-[calc(100vh-16rem)] scrollbar-thin rounded-xl bg-background border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="w-10 px-3 py-2 text-left">
                <Checkbox
                  checked={selectedIds.size === paginatedResults.length && paginatedResults.length > 0}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cargo</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Empresa</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Teléfono</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">LinkedIn</th>
            </tr>
          </thead>
          <tbody>
            {usingMock || filteredResults.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                  {usingMock ? 'Sin resultados. Realiza una búsqueda.' : 'No se encontraron resultados'}
                </td>
              </tr>
            ) : (
              paginatedResults.map((r) => {
                const isSelected = selectedIds.has(r.id);
                return (
                  <tr key={r.id} className={cn('border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer', isSelected && 'bg-primary/5')} onClick={() => toggleSelect(r.id)}>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(r.id)} />
                    </td>
                    <td className="px-3 py-2.5 font-medium">{enrichedPersons[r.id]?.name || r.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.title}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{r.company}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {enrichedPersons[r.id]?.email ? (
                        <span className="text-[#13944C]">{enrichedPersons[r.id].email}</span>
                      ) : r.email ? (
                        r.email
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); void handleEnrich(r.id); }} className="text-[#13944C] hover:underline text-xs font-medium">
                          Desbloquear
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {enrichedPersons[r.id]?.phone ? (
                        <span className="text-[#13944C]">{enrichedPersons[r.id].phone}</span>
                      ) : r.phone ? (
                        r.phone
                      ) : (
                        <span className="text-muted-foreground/40">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {enrichedPersons[r.id]?.linkedin_url ? (
                        <a href={enrichedPersons[r.id].linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#13944C] hover:underline text-xs" onClick={(e) => e.stopPropagation()}>
                          Perfil ↗
                        </a>
                      ) : (
                        <span className="text-muted-foreground/40">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!usingMock && (
          <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground sticky bottom-0 bg-background">
            <span className="tabular-nums">{filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="tabular-nums">Pág. {page} de {totalPages}</span>
              <Button variant="ghost" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar contactos</DialogTitle>
            <DialogDescription>
              Se crearán {selectedRows.length} contacto{selectedRows.length !== 1 ? 's' : ''} en el CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {selectedRows.map((row) => (
              <div key={row.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                <Check className="size-3.5 shrink-0 text-[#13944C]" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{enrichedPersons[row.id]?.name || row.name}</p>
                  <p className="text-muted-foreground truncate">{row.company}{row.email ? ` · ${row.email}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => void handleImport()} disabled={importing}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {importing ? 'Importando...' : `Importar (${selectedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      )}

      {activeTab === 'empresas' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-1.5 h-9 shadow-none">
                  <Bookmark className="size-4" /> Búsquedas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => { setSaveDialogOpen(true); setSaveName(''); }}>
                  <Plus className="size-3.5" /> Guardar búsqueda actual
                </DropdownMenuItem>
                {searchesForCurrentTab().length > 0 && <DropdownMenuSeparator />}
                {searchesForCurrentTab().map((s) => (
                  <div key={s.id} className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-muted cursor-pointer" onClick={() => handleApplySearch(s)}>
                    <Bookmark className="size-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{s.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSearch(s.id); }} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
                {searchesForCurrentTab().length === 0 && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Sin búsquedas guardadas</p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="gap-1.5 h-9 shadow-none" onClick={() => setEmpresasFilterOpen(!empresasFilterOpen)}>
              <SlidersHorizontal className="size-4" /> Filtros
            </Button>
            <div className="relative flex-1 min-w-[300px] max-w-xl">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={companiesQuery}
                onChange={(e) => setCompaniesQuery(e.target.value)}
                placeholder="Buscar empresas por nombre..."
                className="pl-9 shadow-none"
                onKeyDown={(e) => e.key === 'Enter' && void handleCompaniesSearch()}
              />
            </div>
          </div>

          {companiesError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
              {companiesError}
            </div>
          )}

          <div className="flex gap-4 flex-1 min-h-0">
            {empresasFilterOpen && (
              <div className="w-72 shrink-0 self-start space-y-4 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filtros</p>
                  <button onClick={() => setEmpresasFilterOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cerrar</button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Industria</Label>
                  <Input value={empresasIndustry} onChange={(e) => setEmpresasIndustry(e.target.value)} placeholder="Ej: Tecnología..." className="h-8 text-xs shadow-none" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ubicación</Label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {empresasLocation.map((l) => (
                      <span key={l} className="inline-flex items-center gap-1 rounded-md bg-[#13944C]/10 px-2 py-0.5 text-xs text-[#13944C]">
                        {l}
                        <button onClick={() => setEmpresasLocation((prev) => prev.filter((x) => x !== l))} className="hover:text-destructive">&times;</button>
                      </span>
                    ))}
                  </div>
                  <Input
                    value={empresasLocationInput}
                    onChange={(e) => setEmpresasLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && empresasLocationInput.trim()) {
                        e.preventDefault();
                        setEmpresasLocation((prev) => [...prev, empresasLocationInput.trim()]);
                        setEmpresasLocationInput('');
                      }
                    }}
                    placeholder="Ciudad, país..."
                    className="h-8 text-xs shadow-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Empleados</Label>
                  <div className="flex items-center gap-2">
                    <Input value={empresasEmployeeMin} onChange={(e) => setEmpresasEmployeeMin(e.target.value)} placeholder="Mín" className="h-8 text-xs shadow-none w-full" type="number" />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input value={empresasEmployeeMax} onChange={(e) => setEmpresasEmployeeMax(e.target.value)} placeholder="Máx" className="h-8 text-xs shadow-none w-full" type="number" />
                  </div>
                </div>

                <Button size="sm" className="w-full" onClick={() => void handleCompaniesSearch()}>
                  Aplicar filtros
                </Button>
              </div>
            )}
             <div className="flex-1 overflow-auto max-h-[calc(100vh-16rem)] scrollbar-thin rounded-xl bg-background border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Industria</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ubicación</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Empleados</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Web</th>
                </tr>
              </thead>
              <tbody>
                {!companiesResults || companiesResults.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                      {companiesResults === null ? 'Realiza una búsqueda' : 'No se encontraron resultados'}
                    </td>
                  </tr>
                ) : (
                  companiesResults.map((org) => (
                    <tr key={org.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{org.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{org.industry || '-'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{[org.city, org.country].filter(Boolean).join(', ') || '-'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{org.employee_count ?? '-'}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {org.website ? (
                          <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-[#13944C] hover:underline">
                            {org.website.replace(/^https?:\/\//, '').slice(0, 30)}
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'listas' && (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            {savedSearches.length} búsqueda{savedSearches.length !== 1 ? 's' : ''} guardada{savedSearches.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Search className="size-4" /> Personas
            </h3>
            {savedSearches.filter((s) => s.type === 'personas').length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                <Bookmark className="mx-auto size-8 mb-2 opacity-30" />
                <p>Sin búsquedas de personas guardadas</p>
                <p className="mt-1">Busca en Personas y usa "Guardar búsqueda actual"</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedSearches.filter((s) => s.type === 'personas').map((s) => (
                  <div key={s.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Personas{s.query ? ` · ${s.query}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon-sm" variant="ghost" className="size-7" onClick={() => handleApplySearch(s)}>
                          <Search className="size-3" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSearch(s.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Building2 className="size-4" /> Empresas
            </h3>
            {savedSearches.filter((s) => s.type === 'empresas').length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                <Bookmark className="mx-auto size-8 mb-2 opacity-30" />
                <p>Sin búsquedas de empresas guardadas</p>
                <p className="mt-1">Busca en Empresas y usa "Guardar búsqueda actual"</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedSearches.filter((s) => s.type === 'empresas').map((s) => (
                  <div key={s.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Empresas{s.query ? ` · ${s.query}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon-sm" variant="ghost" className="size-7" onClick={() => handleApplySearch(s)}>
                          <Search className="size-3" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSearch(s.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save search dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar búsqueda</DialogTitle>
            <DialogDescription>Asigna un nombre a esta búsqueda para recuperarla después.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nombre de la búsqueda..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#13944C] hover:bg-[#0f7a3d]" onClick={() => void handleSaveCurrent()} disabled={!saveName.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}