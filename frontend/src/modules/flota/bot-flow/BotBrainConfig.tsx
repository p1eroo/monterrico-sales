import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Brain, FlaskConical, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function BotBrainConfig() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <fieldset className="space-y-1.5" disabled>
            <Label>Brain mode</Label>
            <Input value="flow_with_ai" readOnly className="opacity-60" />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>AI Provider</Label>
            <Input value="OpenAI" readOnly className="opacity-60" />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>Model</Label>
            <Input value="gpt-4o" readOnly className="opacity-60" />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>Temperature</Label>
            <Input type="number" value="0.7" readOnly className="opacity-60" />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>Max tokens</Label>
            <Input type="number" value="2048" readOnly className="opacity-60" />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>
        </div>

        <div className="space-y-4">
          <fieldset className="space-y-1.5" disabled>
            <Label>System prompt</Label>
            <Textarea
              rows={4}
              value="Eres un asistente experto en afiliación de conductores para Taxi Monterrico. Tu objetivo es guiar al usuario a través del proceso de registro y resolver dudas sobre requisitos."
              readOnly
              className="opacity-60"
            />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>Business rules</Label>
            <Textarea
              rows={3}
              value="1. El conductor debe tener DNI vigente. 2. El vehículo debe tener SOAT al día. 3. No aceptar conductores con antecedentes."
              readOnly
              className="opacity-60"
            />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>Min confidence ({'>= 0.7'})</Label>
            <div className="flex items-center gap-3">
              <Slider defaultValue={[70]} max={100} step={5} className="flex-1 opacity-60" />
              <span className="text-xs font-mono w-8">0.7</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label>Fallback strategy</Label>
            <Input value="human_handoff" readOnly className="opacity-60" />
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>

          <fieldset className="space-y-1.5" disabled>
            <Label className="flex items-center gap-2">
              Enable memory
              <Switch checked={false} className="opacity-60" />
            </Label>
            <p className="text-[11px] text-muted-foreground">Coming soon</p>
          </fieldset>
        </div>
      </div>
      </div>

      <div className="flex items-center gap-2 border-t px-6 py-4 shrink-0">
        <Button
          variant="default"
          className="gap-1.5"
          onClick={() => toast.success('Test brain simulation triggered (mock)')}
        >
          <FlaskConical className="size-4" /> Test brain
        </Button>
        <Button variant="outline" className="gap-1.5" disabled>
          Save configuration <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
