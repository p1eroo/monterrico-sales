import { useParams, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  ArrowLeft, Building2, Users, DollarSign,
} from 'lucide-react';
import { useCRMStore } from '@/store/crmStore';
import { companyRubroLabels } from '@/data/mock';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads } = useCRMStore();

  const companyName = id ? decodeURIComponent(id) : '';

  const companyLeads = useMemo(() => {
    if (!companyName) return [];
    return leads.filter((l) =>
      l.companies?.some((c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase()),
    );
  }, [leads, companyName]);

  const firstLead = companyLeads[0];
  const companyData = firstLead?.companies?.find(
    (c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase(),
  );
  const totalValue = companyLeads.reduce((sum: number, l) => sum + l.estimatedValue, 0);

  if (!companyName || companyLeads.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/empresas')}>
          <ArrowLeft /> Volver a Empresas
        </Button>
        <EmptyState
          icon={Building2}
          title="Empresa no encontrada"
          description="La empresa que buscas no existe o no tiene contactos asociados."
          actionLabel="Volver a Empresas"
          onAction={() => navigate('/empresas')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/empresas')}>
            <ArrowLeft /> Volver a Empresas
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-[#13944C]/10">
              <Building2 className="size-6 text-[#13944C]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{companyData?.name ?? companyName}</h1>
              {companyData?.domain && (
                <a
                  href={companyData.domain.startsWith('http') ? companyData.domain : `https://${companyData.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  {companyData.domain}
                </a>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                {companyData?.rubro && (
                  <Badge variant="outline">{companyRubroLabels[companyData.rubro]}</Badge>
                )}
                {companyData?.tipo && (
                  <Badge variant="secondary">Tipo {companyData.tipo}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contactos</p>
                <p className="text-2xl font-bold">{companyLeads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <DollarSign className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor total estimado</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contactos de la empresa */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Contactos en esta empresa</CardTitle>
          <Button size="sm" onClick={() => navigate('/contactos')}>
            <Users className="size-4" /> Ver todos los contactos
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Valor estimado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/contactos/${lead.id}`)}
                  >
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {lead.phone}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {lead.email}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lead.etapa} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lead.estimatedValue)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/contactos/${lead.id}`);
                        }}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
