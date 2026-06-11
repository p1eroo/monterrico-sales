import { useState, useMemo } from 'react';
import { Search, X, Download, Sparkles, Building2, MapPin, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    'Supervisor de Flota', 'Analista de Operaciones', 'Jefe de Mantenimiento',
    'Gerente de Recursos Humanos', 'Controller Financiero',
  ];
  const companies = [
    'Transportes Mendoza SAC', 'Flotas del Perú EIRL', 'Logística Integral SAC',
    'Distribuidora Norte SA', 'Cargo Express SAC', 'Translogística Perú',
    'Moviliza SAC', 'Cadena de Suministros SA', 'Transportes Rápidos EIRL',
    'Carga Pesada del Perú', 'Logística Andina SAC', 'Distribuidora Sur SA',
    'Flota Express Perú', 'Transportes Unidos SAC', 'Carga Liviana EIRL',
  ];
  const industries = [
    'Logística', 'Transporte', 'Distribución', 'Supply Chain', 'Minería',
    'Construcción', 'Alimentos', 'Retail', 'Manufactura', 'Tecnología',
  ];
  const cities = [
    'Lima', 'Callao', 'Arequipa', 'Trujillo', 'Cusco', 'Piura', 'Chiclayo',
    'Huancayo', 'Iquitos', 'Pucallpa', 'Tacna', 'Juliaca',
  ];
  return names.map((name, i) => ({
    id: String(i + 1),
    name,
    title: titles[i % titles.length],
    email: name.toLowerCase().replace(/ /g, '.').replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u') + '@gmail.com',
    phone: `9${String(90000000 + i * 12345).slice(0, 8)}`,
    company: companies[i % companies.length],
    industry: industries[i % industries.length],
    location: `${cities[i % cities.length]}, Perú`,
  }));
})();

interface ApolloSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ApolloSearchModal({ open, onOpenChange }: ApolloSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [hasSearched, setHasSearched] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 25;

  const filteredResults = useMemo(() => {
    return MOCK_RESULTS.filter((r) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase()) && !r.company.toLowerCase().includes(query.toLowerCase()) && !r.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (industryFilter && !r.industry.toLowerCase().includes(industryFilter.toLowerCase())) return false;
      if (locationFilter && !r.location.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      return true;
    });
  }, [query, industryFilter, locationFilter]);

  const totalPages = Math.ceil(filteredResults.length / perPage);
  const paginatedResults = filteredResults.slice((page - 1) * perPage, page * perPage);

  const industries = useMemo(() => {
    return Array.from(new Set(MOCK_RESULTS.map((r) => r.industry))).sort();
  }, []);

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

  function handleSearch() {
    setHasSearched(true);
    setPage(1);
    setSelectedIds(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex h-[92vh] w-[98vw] sm:max-w-[1800px] flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex w-full items-center justify-between gap-3 border-b px-6 py-4 shrink-0">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Buscar por nombre, empresa, cargo..."
              className="pl-9"
              autoFocus
            />
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Filters sidebar */}
          <aside className="w-64 shrink-0 border-r overflow-y-auto p-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Industria</label>
              <Input
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                placeholder="Buscar industria..."
                className="h-8 text-xs"
                list="industry-options"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <datalist id="industry-options">
                {industries.map((ind) => (
                  <option key={ind} value={ind} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ubicación</label>
              <Input
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Ciudad, país..."
                className="h-8 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
            </div>
            <Button className="w-full gap-1.5" size="sm" onClick={handleSearch}>
              <Search className="size-3.5" /> Buscar
            </Button>
          </aside>

          {/* Results */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Results toolbar */}
            <div className="flex items-center justify-between border-b px-4 py-2 shrink-0 bg-muted/30">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {hasSearched ? (
                  <>
                    <span className="font-medium text-foreground">{filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>Créditos: <span className="font-medium text-foreground">842</span> disponibles</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Usa los filtros y presiona Buscar</span>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] font-normal">Mock · Sin API</Badge>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {!hasSearched ? null : paginatedResults.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                  No se encontraron resultados
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
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
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ubicación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((r) => {
                      const isSelected = selectedIds.has(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            'border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer',
                            isSelected && 'bg-primary/5',
                          )}
                          onClick={() => toggleSelect(r.id)}
                        >
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(r.id)} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                {r.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className="font-medium">{r.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.title}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[160px]">{r.company}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.email}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{r.phone}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="size-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[120px]">{r.location}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-3 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" disabled={selectedIds.size === 0} className="gap-1.5">
              <Download className="size-3.5" /> Importar ({selectedIds.size})
            </Button>
            <Button variant="outline" size="sm" disabled={selectedIds.size === 0} className="gap-1.5">
              <Sparkles className="size-3.5" /> Research IA
            </Button>
          </div>
          {hasSearched && totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="tabular-nums">Pág. {page} de {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
