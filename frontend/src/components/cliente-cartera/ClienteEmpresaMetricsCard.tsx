import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ClienteEmpresaRow } from '@/lib/clienteCarteraApi';

type MetricsSource = Pick<
  ClienteEmpresaRow,
  | 'mes1'
  | 'monto1'
  | 'mes2'
  | 'monto2'
  | 'mes3'
  | 'monto3'
  | 'mes4'
  | 'monto4'
  | 'mes5'
  | 'monto5'
>;

function buildMonthlyMetrics(empresa: MetricsSource) {
  return [1, 2, 3, 4, 5]
    .map((i) => {
      const name = empresa[`mes${i}` as keyof MetricsSource] as string | undefined;
      const amount = empresa[`monto${i}` as keyof MetricsSource] as number | undefined;
      if (!name) return null;
      return { key: `${name}-${i}`, name, amount: amount ?? 0 };
    })
    .filter((m): m is { key: string; name: string; amount: number } => m !== null);
}

export function ClienteEmpresaMetricsCard({ empresa }: { empresa: MetricsSource }) {
  const [open, setOpen] = useState(true);
  const monthlyMetrics = buildMonthlyMetrics(empresa);

  if (monthlyMetrics.length === 0) return null;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="p-0">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Métricas
            </CardTitle>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="grid grid-cols-3 gap-2">
              {monthlyMetrics.map((m) => (
                <div
                  key={m.key}
                  className="flex flex-col items-center justify-center rounded-lg p-2 text-center shadow-sm"
                >
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {m.name.substring(0, 3)}
                  </span>
                  <span className="mt-1 text-sm font-bold text-blue-600">
                    {m.amount.toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="mt-0.5 text-[9px] text-muted-foreground">Soles</span>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
