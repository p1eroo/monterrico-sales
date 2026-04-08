import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { MockLog } from '../mockData';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Props = {
  log: MockLog | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function LogDetailSheet({ log, open, onOpenChange }: Props) {
  if (!log) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={rightDrawerSheetContentClass('md', 'gap-4 overflow-y-auto p-6')}
      >
        <SheetHeader className="text-left">
          <SheetTitle>Detalle de traza</SheetTitle>
          <SheetDescription>
            {format(new Date(log.at), "PPpp", { locale: es })} ·{' '}
            {log.conversationId}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{log.type}</Badge>
          <Badge variant={log.mode === 'prod' ? 'default' : 'secondary'}>
            {log.mode}
          </Badge>
        </div>

        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Agente</span>
          <span className="font-medium">{log.agentName}</span>
        </div>

        <Separator />

        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Decisión</span>
          <p>{log.decision}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Confianza</p>
            <p className="font-mono font-medium">
              {(log.confidence * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tokens</p>
            <p className="font-mono font-medium">{log.tokens}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Latencia</p>
            <p className="font-mono font-medium">{log.latencyMs} ms</p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-2">
          <span className="text-sm font-medium">Detalle técnico</span>
          <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {log.detail}
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}
