import { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgentesIaStore } from '../store';
import {
  apiRowToMockKnowledge,
  createKnowledgeBase,
  fetchKnowledgeBases,
  uploadKnowledgeBaseFiles,
  type KnowledgeBaseApiRow,
} from '../knowledgeApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Upload, X } from 'lucide-react';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

/** Origen del contenido de la base (UI). */
export type KnowledgeSourceMode =
  | 'text_only'
  | 'upload'
  | 'url'
  | 'existing';

const SOURCE_OPTIONS: {
  value: KnowledgeSourceMode;
  label: string;
  hint: string;
}[] = [
  {
    value: 'text_only',
    label: 'Solo texto',
    hint: 'Pegar o escribir contenido directamente',
  },
  {
    value: 'upload',
    label: 'Subir archivos',
    hint: 'Texto, Markdown, JSON, CSV o HTML (hasta 10 MB/archivo)',
  },
  {
    value: 'url',
    label: 'URL o API',
    hint: 'Página o endpoint REST para ingerir texto/JSON',
  },
  {
    value: 'existing',
    label: 'Repositorio existente',
    hint: 'Adjuntos ya en el CRM',
  },
];

const AGENT_NONE = '__none__';

const MAX_KB_UPLOAD_BYTES = 10 * 1024 * 1024;
const KB_UPLOAD_ACCEPT =
  '.txt,.md,.markdown,.json,.csv,.tsv,.html,.htm,text/plain,text/markdown,application/json,text/csv,text/html';

/** Aproximación útil en UI (no es tiktoken; ~3.5 caracteres ≈ 1 token en ES/EN mezclado). */
function estimateTokensApprox(text: string): number {
  const t = text.trim();
  if (!t.length) return 0;
  return Math.max(1, Math.ceil(t.length / 3.5));
}

function parseChunkTarget(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n < 64) return fallback;
  return Math.min(n, 8192);
}

export function NewKnowledgeDialog({ open, onOpenChange }: Props) {
  const setKnowledge = useAgentesIaStore((s) => s.setKnowledge);
  const agents = useAgentesIaStore((s) => s.agents);
  const [title, setTitle] = useState('');
  const [sourceMode, setSourceMode] = useState<KnowledgeSourceMode>('text_only');
  const [textContent, setTextContent] = useState('');
  const [urlNotes, setUrlNotes] = useState('');
  const [endpoint, setEndpoint] = useState('');
  /** GET: documento/URL; POST: API con cuerpo opcional */
  const [urlMethod, setUrlMethod] = useState<'GET' | 'POST'>('GET');
  const [urlAuth, setUrlAuth] = useState<'none' | 'bearer' | 'apikey'>('none');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-Api-Key');
  const [postBodyJson, setPostBodyJson] = useState('');
  /** Qué conjunto de adjuntos del CRM se indexará (demo: solo registro textual). */
  const [existingScope, setExistingScope] = useState<
    | 'files_catalog'
    | 'contact'
    | 'company'
    | 'opportunity'
    | 'freeform'
  >('files_catalog');
  const [existingEntityId, setExistingEntityId] = useState('');
  const [existingHint, setExistingHint] = useState('');
  const [agentSelection, setAgentSelection] = useState<string>(AGENT_NONE);
  const [chunking, setChunking] = useState('400');
  const [overlap, setOverlap] = useState('64');
  const [saving, setSaving] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDragActive, setUploadDragActive] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadDragDepth = useRef(0);

  const chunkTarget = useMemo(() => parseChunkTarget(chunking, 400), [chunking]);
  const overlapTokens = useMemo(() => {
    const n = Number.parseInt(overlap.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n) || n < 0) return 64;
    return Math.min(n, 4096);
  }, [overlap]);
  const tokenEst = useMemo(() => estimateTokensApprox(textContent), [textContent]);
  const approxChunks =
    tokenEst > 0 ? Math.max(1, Math.ceil(tokenEst / chunkTarget)) : 0;

  function reset() {
    setTitle('');
    setSourceMode('text_only');
    setTextContent('');
    setUrlNotes('');
    setEndpoint('');
    setUrlMethod('GET');
    setUrlAuth('none');
    setApiKeyHeader('X-Api-Key');
    setPostBodyJson('');
    setExistingScope('files_catalog');
    setExistingEntityId('');
    setExistingHint('');
    setAgentSelection(AGENT_NONE);
    setChunking('400');
    setOverlap('64');
    setSaving(false);
    setUploadFiles([]);
    setUploadDragActive(false);
    uploadDragDepth.current = 0;
  }

  function addUploadFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    setUploadFiles((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (f.size > MAX_KB_UPLOAD_BYTES) {
          toast.error(`${f.name}: supera 10 MB`);
          continue;
        }
        const dup = next.some((x) => x.name === f.name && x.size === f.size);
        if (dup) continue;
        next.push(f);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Indica un título');
      return;
    }

    let descriptionForRow = '';
    let toastDetail = '';
    let knowledgeType: 'documentos' | 'web' = 'documentos';
    let sourcePayload: Record<string, unknown> | undefined;

    switch (sourceMode) {
      case 'text_only':
        if (!textContent.trim()) {
          toast.error('Añade contenido en el recuadro de texto');
          return;
        }
        descriptionForRow = textContent.trim();
        knowledgeType = 'documentos';
        toastDetail = `~${estimateTokensApprox(descriptionForRow)} tokens estimados · ~${approxChunks} fragmentos (aprox.).`;
        break;
      case 'upload':
        if (uploadFiles.length === 0) {
          toast.error(
            'Añade uno o más archivos arrastrándolos o con «Elegir archivos»',
          );
          return;
        }
        knowledgeType = 'documentos';
        toastDetail = `${uploadFiles.length} archivo(s) · texto plano, Markdown, JSON, CSV o HTML.`;
        break;
      case 'url': {
        const urlRaw = endpoint.trim();
        if (!urlRaw) {
          toast.error('Indica la URL o endpoint');
          return;
        }
        try {
          new URL(urlRaw);
        } catch {
          toast.error('La URL no parece válida (incluye https://...)');
          return;
        }
        if (urlMethod === 'POST' && postBodyJson.trim()) {
          try {
            JSON.parse(postBodyJson.trim());
          } catch {
            toast.error('El cuerpo POST debe ser JSON válido o déjalo vacío');
            return;
          }
        }
        const authLine =
          urlAuth === 'none'
            ? 'Autenticación: ninguna'
            : urlAuth === 'bearer'
              ? 'Autenticación: Bearer (el secreto se guardará solo en el servidor; no en esta demo)'
              : `Autenticación: API Key en cabecera «${apiKeyHeader.trim() || 'X-Api-Key'}» (valor solo en servidor)`;
        const bodyLine =
          urlMethod === 'POST' && postBodyJson.trim()
            ? `\nCuerpo (JSON):\n${postBodyJson.trim()}`
            : '';
        const core = [
          '[Origen URL / API — registro demo]',
          `Método: ${urlMethod}`,
          `Endpoint: ${urlRaw}`,
          authLine + bodyLine,
        ].join('\n');
        descriptionForRow = urlNotes.trim()
          ? `${urlNotes.trim()}\n\n${core}`
          : core;
        knowledgeType = 'web';
        sourcePayload = {
          url: urlRaw,
          method: urlMethod,
          authType: urlAuth,
          ...(urlAuth === 'apikey'
            ? {
                apiKeyHeader: apiKeyHeader.trim() || 'X-Api-Key',
              }
            : {}),
          ...(urlMethod === 'POST' && postBodyJson.trim()
            ? { postBody: postBodyJson.trim() }
            : {}),
          ...(urlNotes.trim() ? { notes: urlNotes.trim() } : {}),
        };
        toastDetail =
          'GET sin autenticación: el servidor intentará descargar e indexar. Con POST o credenciales quedará registrado para ingesta futura.';
        break;
      }
      case 'existing': {
        const scopeLabels: Record<typeof existingScope, string> = {
          files_catalog:
            'Catálogo del módulo Archivos (documentos del CRM con permisos del usuario)',
          contact: 'Adjuntos y archivos vinculados a un contacto',
          company: 'Adjuntos y archivos vinculados a una empresa',
          opportunity:
            'Adjuntos y archivos vinculados a una oportunidad',
          freeform: 'Criterio libre descrito abajo',
        };
        if (
          existingScope !== 'files_catalog' &&
          existingScope !== 'freeform' &&
          !existingEntityId.trim()
        ) {
          toast.error('Indica el ID o UUID de la entidad');
          return;
        }
        if (existingScope === 'freeform' && !existingHint.trim()) {
          toast.error(
            'Describe el criterio (carpeta, etiquetas, búsqueda…) en el cuadro de texto',
          );
          return;
        }
        const lines = [
          '[Repositorio CRM — registro demo]',
          `Ámbito: ${scopeLabels[existingScope]}`,
        ];
        if (
          existingScope !== 'files_catalog' &&
          existingScope !== 'freeform'
        ) {
          lines.push(`Entidad: ${existingEntityId.trim()}`);
        }
        if (existingHint.trim()) {
          lines.push(`Filtros / notas: ${existingHint.trim()}`);
        }
        descriptionForRow = lines.join('\n');
        knowledgeType = 'documentos';
        sourcePayload = {
          scope: existingScope,
          ...(existingEntityId.trim() ? { entityId: existingEntityId.trim() } : {}),
          ...(existingHint.trim() ? { hint: existingHint.trim() } : {}),
        };
        toastDetail =
          'Ámbito guardado en el servidor; la ingesta desde Archivos/entidades se implementará en una siguiente fase.';
        break;
      }
      default:
        return;
    }

    const linked =
      agentSelection === AGENT_NONE
        ? undefined
        : agents.find((a) => a.id === agentSelection);

    setSaving(true);
    try {
      let created: KnowledgeBaseApiRow;

      if (sourceMode === 'upload') {
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('chunkSize', String(chunkTarget));
        fd.append('overlap', String(overlapTokens));
        if (linked) {
          fd.append('linkedAgentId', linked.id);
          fd.append('linkedAgentName', linked.name);
        }
        for (const f of uploadFiles) {
          fd.append('files', f);
        }
        created = await uploadKnowledgeBaseFiles(fd);
      } else {
        created = await createKnowledgeBase({
          title: title.trim(),
          type: knowledgeType,
          sourceMode,
          description: descriptionForRow,
          chunkSize: chunkTarget,
          overlap: overlapTokens,
          linkedAgentId: linked?.id ?? null,
          linkedAgentName: linked?.name ?? null,
          ...(sourcePayload ? { source: sourcePayload } : {}),
        });
      }
      const list = await fetchKnowledgeBases();
      setKnowledge(list.map(apiRowToMockKnowledge));

      const okMsg =
        created.status === 'indexado'
          ? `Indexado: ${created.chunks} fragmento(s) en base de datos.`
          : created.status === 'error'
            ? `Falló la ingesta automática (p. ej. URL). Revisa el registro en la tabla.`
            : toastDetail;

      if (created.status === 'error') {
        toast.warning('Base guardada con avisos', { description: okMsg });
      } else {
        toast.success('Base de conocimiento guardada', { description: okMsg });
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Error al guardar la base de conocimiento';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[min(90dvh,760px)] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-2xl sm:w-full">
        <DialogHeader>
          <DialogTitle>Nueva base de conocimiento</DialogTitle>
          <DialogDescription>
            Elige el origen del contenido y el tamaño de fragmento para la
            recuperación semántica.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="kb-title">Título</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre para el catálogo operativo"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="kb-source">Origen del contenido</Label>
            <Select
              value={sourceMode}
              onValueChange={(v) =>
                setSourceMode(v as KnowledgeSourceMode)
              }
            >
              <SelectTrigger id="kb-source" className="w-full">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} title={o.hint}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceMode === 'text_only' && (
            <div className="grid gap-2">
              <Label htmlFor="kb-text">Contenido</Label>
              <Textarea
                id="kb-text"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={8}
                className="min-h-[180px] resize-y font-mono text-sm"
                placeholder="Escribe o pega el texto que debe poder recuperar el asistente…"
              />
              <p
                className={cn(
                  'text-xs text-muted-foreground',
                  tokenEst > 12_000 && 'text-amber-700 dark:text-amber-400',
                )}
              >
                ~{tokenEst} tokens (estimado) · se dividirá en chunks de ~
                {chunkTarget} tokens
                {tokenEst > 0 && (
                  <>
                    {' '}
                    · ~{approxChunks} fragmento
                    {approxChunks !== 1 ? 's' : ''} aprox.
                  </>
                )}
                {tokenEst > 12_000 ? (
                  <span className="mt-1 block">
                    Texto muy largo para una sola entrada: en producción conviene
                    dividir en varios documentos o subir archivos.
                  </span>
                ) : null}
              </p>
            </div>
          )}

          {sourceMode === 'upload' && (
            <div className="grid gap-2">
              <Label>Archivos</Label>
              <input
                ref={uploadInputRef}
                type="file"
                accept={KB_UPLOAD_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  const fl = e.target.files;
                  if (fl?.length) addUploadFiles(fl);
                  e.target.value = '';
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    uploadInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  uploadDragDepth.current += 1;
                  setUploadDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  uploadDragDepth.current -= 1;
                  if (uploadDragDepth.current <= 0) {
                    uploadDragDepth.current = 0;
                    setUploadDragActive(false);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  uploadDragDepth.current = 0;
                  setUploadDragActive(false);
                  if (e.dataTransfer.files?.length) {
                    addUploadFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => uploadInputRef.current?.click()}
                className={cn(
                  'cursor-pointer rounded-md border-2 border-dashed px-3 py-8 text-center text-sm transition-colors',
                  uploadDragActive
                    ? 'border-[#13944C] bg-[#13944C]/10 text-foreground'
                    : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/35',
                )}
              >
                <Upload className="mx-auto mb-2 size-8 opacity-70" aria-hidden />
                <p className="font-medium text-foreground">
                  Arrastra archivos aquí
                </p>
                <p className="mt-1 text-xs">
                  o haz clic para elegir · hasta{' '}
                  <strong>10 MB</strong> por archivo
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  .txt, .md, .json, .csv, .html (PDF u Office: aún no)
                </p>
              </div>
              {uploadFiles.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2 text-xs">
                  {uploadFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${f.size}-${i}`}
                      className="flex items-center justify-between gap-2 py-1"
                    >
                      <span className="min-w-0 truncate" title={f.name}>
                        {f.name}{' '}
                        <span className="text-muted-foreground">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          );
                        }}
                        aria-label={`Quitar ${f.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {sourceMode === 'url' && (
            <div className="grid gap-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">URL pública:</span>{' '}
                suele bastar <strong>GET</strong> (p. ej. Markdown o JSON público).{' '}
                <span className="font-medium text-foreground">API externa:</span>{' '}
                elige <strong>POST</strong>, cuerpo JSON si aplica y cómo se autentica;
                los <strong>secretos no se guardan</strong> en este listado local.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="kb-endpoint">URL del endpoint</Label>
                <Input
                  id="kb-endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://api.tercero.com/v1/recursos"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-y-3 gap-x-4 sm:grid-cols-2 sm:gap-x-6">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="kb-url-method">Método HTTP</Label>
                  <Select
                    value={urlMethod}
                    onValueChange={(v) => setUrlMethod(v as 'GET' | 'POST')}
                  >
                    <SelectTrigger id="kb-url-method" className="min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET — recurso público</SelectItem>
                      <SelectItem value="POST">POST — API (cuerpo opcional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="kb-url-auth">Autenticación</Label>
                  <Select
                    value={urlAuth}
                    onValueChange={(v) =>
                      setUrlAuth(v as 'none' | 'bearer' | 'apikey')
                    }
                  >
                    <SelectTrigger id="kb-url-auth" className="min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      <SelectItem value="bearer">Bearer (Authorization)</SelectItem>
                      <SelectItem value="apikey">API Key (cabecera)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {urlAuth === 'apikey' && (
                <div className="grid gap-2">
                  <Label htmlFor="kb-apikey-header">Nombre de la cabecera</Label>
                  <Input
                    id="kb-apikey-header"
                    value={apiKeyHeader}
                    onChange={(e) => setApiKeyHeader(e.target.value)}
                    placeholder="X-Api-Key o Authorization"
                  />
                </div>
              )}
              {urlMethod === 'POST' && (
                <div className="grid gap-2">
                  <Label htmlFor="kb-post-body">Cuerpo JSON (opcional)</Label>
                  <Textarea
                    id="kb-post-body"
                    value={postBodyJson}
                    onChange={(e) => setPostBodyJson(e.target.value)}
                    rows={4}
                    className="font-mono text-xs"
                    placeholder='{"consulta": "últimos precios"}'
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="kb-url-notes">
                  Notas para el equipo / contexto adicional (opcional)
                </Label>
                <Textarea
                  id="kb-url-notes"
                  value={urlNotes}
                  onChange={(e) => setUrlNotes(e.target.value)}
                  rows={3}
                  placeholder="Ej.: qué devuelve la API, mapeo de campos, ambiente sandbox…"
                />
              </div>
            </div>
          )}

          {sourceMode === 'existing' && (
            <div className="grid gap-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Reutiliza documentos que <strong>ya están en Monterrico</strong>{' '}
                (módulo <strong>Archivos</strong> o ficheros ligados a registros).
                El servidor aplicará permisos del usuario y extraerá texto para
                el índice; aquí solo defines <strong>qué subconjunto</strong>{' '}
                quieres.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="kb-existing-scope">Ámbito</Label>
                <Select
                  value={existingScope}
                  onValueChange={(v) =>
                    setExistingScope(
                      v as
                        | 'files_catalog'
                        | 'contact'
                        | 'company'
                        | 'opportunity'
                        | 'freeform',
                    )
                  }
                >
                  <SelectTrigger id="kb-existing-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="files_catalog">
                      Archivos del CRM (catálogo general)
                    </SelectItem>
                    <SelectItem value="contact">
                      Archivos de un contacto
                    </SelectItem>
                    <SelectItem value="company">
                      Archivos de una empresa
                    </SelectItem>
                    <SelectItem value="opportunity">
                      Archivos de una oportunidad
                    </SelectItem>
                    <SelectItem value="freeform">
                      Criterio libre (solo texto)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {existingScope !== 'files_catalog' &&
                existingScope !== 'freeform' && (
                  <div className="grid gap-2">
                    <Label htmlFor="kb-existing-entity">
                      ID de {existingScope === 'contact' ? 'contacto' : existingScope === 'company' ? 'empresa' : 'oportunidad'}
                    </Label>
                    <Input
                      id="kb-existing-entity"
                      value={existingEntityId}
                      onChange={(e) => setExistingEntityId(e.target.value)}
                      placeholder="UUID o identificador del registro en el CRM"
                      autoComplete="off"
                    />
                  </div>
                )}
              <div className="grid gap-2">
                <Label htmlFor="kb-existing">
                  Filtros adicionales (opcional)
                </Label>
                <Textarea
                  id="kb-existing"
                  value={existingHint}
                  onChange={(e) => setExistingHint(e.target.value)}
                  rows={3}
                  placeholder={
                    existingScope === 'freeform'
                      ? 'Describe el origen: etiquetas, tipos MIME, fechas, carpeta lógica…'
                      : 'Ej.: solo PDF, idioma ES, excluir borradores…'
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                La consulta real a la API de archivos/entidades será la siguiente
                fase; este formulario deja el criterio listo para el backend.
              </p>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kb-chunk">Tamaño de chunk (tokens)</Label>
              <Input
                id="kb-chunk"
                inputMode="numeric"
                value={chunking}
                onChange={(e) => setChunking(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kb-overlap">Solapamiento (tokens)</Label>
              <Input
                id="kb-overlap"
                inputMode="numeric"
                value={overlap}
                onChange={(e) => setOverlap(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="kb-agent">Agente vinculado (opcional)</Label>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Sin función aún
              </span>
            </div>
            <Select
              value={agentSelection}
              onValueChange={setAgentSelection}
            >
              <SelectTrigger id="kb-agent">
                <SelectValue placeholder="Sin vincular" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AGENT_NONE}>Sin vincular</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El enlace a agentes concretos se usará cuando el flujo de
              creación de agentes y el backend estén enlazados.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Guardando…' : 'Guardar e indexar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
