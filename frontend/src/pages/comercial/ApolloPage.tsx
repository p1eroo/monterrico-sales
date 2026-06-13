import { useState, useMemo } from 'react';
import { Search, Download, Sparkles, Building2, MapPin, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { apolloSearch, type ApolloPerson } from '@/lib/apolloApi';

interface MockResult {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  location: string;
}

const MOCK_RESULTS: MockResult[] = (() => {
  const names = [
    'Carlos Mendoza', 'María Torres', 'Juan Pérez', 'Ana Gómez', 'Pedro López',
    'Lucía Fernández', 'Roberto Sánchez', 'Diana Castillo', 'Miguel Ángel', 'Carmen Ruiz',
    'Jorge García', 'Silvia Paredes', 'Alberto Vega', 'Rosa Flores', 'Fernando Díaz',
    'Patricia Castro', 'Gustavo Ríos', 'Mónica Suárez', 'Ricardo Palma', 'Verónica Cruz',
    'Andrés Huerta', 'Liliana Paz', 'Héctor Rivas', 'Elena Pineda', 'Pablo Aguirre',
    'Claudia Mora', 'Oscar Delgado', 'Ruth Salazar', 'Marco León', 'Andrea Campos',
    'Felipe Ortiz', 'Teresa Guerrero', 'Ignacio Vega', 'Sofía Ríos', 'Adrián Ponce',
    'Gabriela Luna', 'Esteban Rivas', 'Natalia Paz', 'Cristian Flores', 'Valeria Cruz',
    'Manuel Huerta', 'Carolina Suárez', 'Sergio Palma', 'Alejandra Mora', 'Hugo Delgado',
    'Beatriz Salazar', 'Luis León', 'Daniela Campos', 'Raúl Ortiz', 'Jimena Guerrero',
    'Emilio Zavala', 'Paola Ibarra', 'Tomás Molina', 'Ángela Cáceres', 'Iván Espinoza',
    'Martha Roldán', 'Diego Figueroa', 'Lorena Tello', 'Vicente Huamán', 'Rocío Paredes',
  ];
  const titles = [
    'CEO', 'Gerente de Flota', 'Director de Operaciones', 'Jefe de Transporte',
    'Gerente General', 'Coordinadora de Flota', 'Subgerente de Operaciones',
    'Head of Supply Chain', 'Director Comercial', 'Gerente de Logística',
  ];
  const companies = [
    'Transportes Mendoza SAC', 'Flotas del Perú EIRL', 'Logística Integral SAC',
    'Distribuidora Norte SA', 'Cargo Express SAC', 'Translogística Perú',
    'Moviliza SAC', 'Cadena de Suministros SA', 'Transportes Rápidos EIRL',
    'Logística Andina SAC', 'Distribuidora Sur SA', 'Flota Express Perú',
  ];
  const industries = [
    'Logística', 'Transporte', 'Distribución', 'Supply Chain', 'Construcción',
    'Manufactura', 'Tecnología', 'Minería', 'Alimentos', 'Retail',
  ];
  const cities = [
    'Lima', 'Callao', 'Arequipa', 'Trujillo', 'Cusco', 'Piura',
    'Chiclayo', 'Huancayo', 'Iquitos', 'Tacna', 'Juliaca', 'Pucallpa',
  ];
  return names.map((name, i) => ({
    id: String(i + 1),
    name,
    title: titles[i % titles.length],
    email: name.toLowerCase().replace(/ /g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@gmail.com',
    phone: `9${String(90000000 + i * 12345).slice(0, 8)}`,
    company: companies[i % companies.length],
    industry: industries[i % industries.length],
    location: `${cities[i % cities.length]}, Perú`,
  }));
})();

export default function ApolloPage() {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiResults, setApiResults] = useState<ApolloPerson[] | null>(null);
  const [apiTotal, setApiTotal] = useState(0);
  const [usingMock, setUsingMock] = useState(true);
  const perPage = 25;

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
    return MOCK_RESULTS;
  }, [apiResults]);

  const filteredResults = useMemo(() => {
    return dataSource.filter((r) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase()) && !r.company.toLowerCase().includes(query.toLowerCase()) && !r.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (industryFilter && !r.industry.toLowerCase().includes(industryFilter.toLowerCase())) return false;
      if (locationFilter && !r.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      return true;
    });
  }, [query, industryFilter, locationFilter, dataSource]);

  const totalPages = Math.ceil(filteredResults.length / perPage);
  const paginatedResults = filteredResults.slice((page - 1) * perPage, page * perPage);

  const industries = useMemo(() => {
    return Array.from(new Set(MOCK_RESULTS.map((r) => r.industry))).sort();
  }, []);

  async function handleApiSearch(newPage = 1) {
    setLoading(true);
    setError('');
    try {
      const res = await apolloSearch({
        query: query || undefined,
        industry: industryFilter || undefined,
        location: locationFilter || undefined,
        page: newPage,
      });
      setApiResults(res.results);
      setApiTotal(res.total);
      setUsingMock(false);
      setPage(newPage);
    } catch {
      setApiResults(null);
      setUsingMock(true);
      setError('Usando datos mock — la API de Apollo requiere plan pago');
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

  return (
    <div className="space-y-6">
      <PageHeader title="Apollo.io" description="Busca y explora prospectos en Apollo">
        {usingMock ? (
          <Badge variant="outline" className="text-xs font-normal">Mock · Sin API</Badge>
        ) : (
          <Badge variant="outline" className="text-xs font-normal text-emerald-600 border-emerald-300">API conectada</Badge>
        )}
      </PageHeader>

      {/* Search + Filters row */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative flex-1 min-w-[300px] max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, empresa, cargo..."
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Input
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            placeholder="Industria..."
            className="text-xs"
            list="industry-options"
          />
          <datalist id="industry-options">
            {industries.map((ind) => (
              <option key={ind} value={ind} />
            ))}
          </datalist>
        </div>
        <div className="w-48">
          <Input
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Ubicación..."
            className="text-xs"
          />
        </div>
        <Button className="gap-1.5" onClick={() => void handleApiSearch()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* Count + Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin inline mr-1" />
          ) : null}
          {filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''}
          {!usingMock && apiTotal > 0 && (
            <span className="text-muted-foreground/50"> · {apiTotal} encontrados</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={selectedIds.size === 0} className="gap-1.5">
            <Download className="size-3.5" /> Importar ({selectedIds.size})
          </Button>
          <Button size="sm" variant="outline" disabled={selectedIds.size === 0} className="gap-1.5">
            <Sparkles className="size-3.5" /> Research IA
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl bg-background border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="w-10 px-3 py-2 text-left">
                <Checkbox checked={selectedIds.size === paginatedResults.length && paginatedResults.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cargo</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Empresa</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Teléfono</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {paginatedResults.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                  No se encontraron resultados
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
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.title}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{r.company}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.email}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.phone}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate max-w-[140px]">{r.location}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="tabular-nums">Pág. {page} de {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
