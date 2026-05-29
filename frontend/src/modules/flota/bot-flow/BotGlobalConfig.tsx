import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function BotGlobalConfig() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">AI Providers</h3>
          <fieldset className="space-y-1.5" disabled>
            <Label>OpenAI model</Label>
            <Input value="gpt-4" readOnly className="opacity-60" />
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label>Anthropic model</Label>
            <Input value="claude-3" readOnly className="opacity-60" />
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label>Default model</Label>
            <Input value="gpt-4" readOnly className="opacity-60" />
          </fieldset>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Usage Limits</h3>
          <fieldset className="space-y-1.5" disabled>
            <Label>Max conversations per bot</Label>
            <Input type="number" value="100" readOnly className="opacity-60" />
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label>Rate limit per minute</Label>
            <Input type="number" value="30" readOnly className="opacity-60" />
          </fieldset>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Automation Schedule</h3>
          <fieldset className="space-y-1.5" disabled>
            <Label className="flex items-center gap-2">
              Enabled
              <Switch checked className="opacity-60" />
            </Label>
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label>Working hours start</Label>
            <Input type="time" value="08:00" readOnly className="opacity-60" />
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label>Working hours end</Label>
            <Input type="time" value="18:00" readOnly className="opacity-60" />
          </fieldset>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Fallback & Handoff</h3>
          <fieldset className="space-y-1.5" disabled>
            <Label>Global fallback message</Label>
            <Textarea rows={2} value="Lo siento, no pude procesar tu solicitud. Un asesor te atenderá pronto." readOnly className="opacity-60" />
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label className="flex items-center gap-2">
              Auto-handoff after failed attempts
              <Switch checked className="opacity-60" />
            </Label>
            <p className="text-[11px] text-muted-foreground">After 3 failed attempts</p>
          </fieldset>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Anti-spam</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fieldset className="space-y-1.5" disabled>
            <Label>Max messages per user</Label>
            <Input type="number" value="20" readOnly className="opacity-60" />
          </fieldset>
          <fieldset className="space-y-1.5" disabled>
            <Label>Cooldown period (seconds)</Label>
            <Input type="number" value="5" readOnly className="opacity-60" />
          </fieldset>
        </div>
      </div>

      </div>

      <div className="shrink-0 border-t px-6 py-4">
        <Button
          variant="default"
          className="gap-1.5"
          onClick={() => toast.success('Global configuration saved (mock)')}
        >
          <Save className="size-4" /> Save configuration
        </Button>
      </div>
    </div>
  );
}
