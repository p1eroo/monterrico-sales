import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/hooks/usePermissions';
import {
  fetchAssistantInstructions,
  patchAssistantInstructions,
} from './assistantInstructionsApi';

const MAX_HINT = 28000;

export function AssistantInstructionsTab() {
  const { hasPermission } = usePermissions();
  const canEdit =
    hasPermission('agentes_ia.editar') || hasPermission('configuracion.editar');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatTools, setChatTools] = useState('');
  const [stream, setStream] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchAssistantInstructions();
      setChatTools(d.instructionsChatTools);
      setStream(d.instructionsStream);
      setUpdatedAt(d.updatedAt);
    } catch {
      toast.error('No se pudieron cargar las instrucciones', {
        description: 'Comprueba permisos (agentes_ia / configuración) y el backend.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      const d = await patchAssistantInstructions({
        instructionsChatTools: chatTools,
        instructionsStream: stream,
      });
      setChatTools(d.instructionsChatTools);
      setStream(d.instructionsStream);
      setUpdatedAt(d.updatedAt);
      toast.success('Instrucciones guardadas');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando instrucciones…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200/80 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 shrink-0 text-amber-800 dark:text-amber-200" />
            Cómo se usa esto
          </CardTitle>
          <CardDescription className="text-sm">
            Estas instrucciones definen el tono y reglas del copiloto. El bloque
            técnico del formato JSON (respuestas con herramientas CRM) lo añade
            siempre el servidor; no hace falta pegarlo aquí. El contexto de pantalla
            y usuario se concatenan automáticamente. Las bases en **Conocimiento**
            son para documentos puntuales (RAG), no sustituyen a esto.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Última actualización:{' '}
          {updatedAt
            ? new Date(updatedAt).toLocaleString('es')
            : '—'}
          {canEdit ? '' : ' · Solo lectura'}
        </p>
        {canEdit && (
          <Button
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Guardar cambios
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Chat con datos CRM (herramientas)
          </CardTitle>
          <CardDescription>
            Usado en el asistente cuando no está activo el modo streaming. Máximo
            ~{MAX_HINT} caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="instr-chat">Texto</Label>
          <Textarea
            id="instr-chat"
            value={chatTools}
            onChange={(e) => setChatTools(e.target.value)}
            readOnly={!canEdit}
            className="min-h-[220px] font-mono text-sm"
            placeholder="Instrucciones para el copiloto con acceso a herramientas…"
          />
          <p className="text-xs text-muted-foreground">
            {chatTools.length} / {MAX_HINT} caracteres
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Respuesta en vivo (streaming)</CardTitle>
          <CardDescription>
            Usado con <code className="text-xs">VITE_AI_CHAT_STREAM=true</code>. Sin
            herramientas CRM; salida en Markdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="instr-stream">Texto</Label>
          <Textarea
            id="instr-stream"
            value={stream}
            onChange={(e) => setStream(e.target.value)}
            readOnly={!canEdit}
            className="min-h-[180px] font-mono text-sm"
            placeholder="Instrucciones para el modo streaming…"
          />
          <p className="text-xs text-muted-foreground">
            {stream.length} / {MAX_HINT} caracteres
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
