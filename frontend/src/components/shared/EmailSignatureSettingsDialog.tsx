import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/lib/notify';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  createSignaturePreviewImageUrl,
  deleteEmailSignature,
  fetchEmailSignature,
  saveEmailSignature,
  signatureHtmlWithoutImage,
  uploadEmailSignatureImage,
} from '@/lib/emailSignatureApi';

const MAX_SIGNATURE_IMAGE_BYTES = 6 * 1024 * 1024;

type EmailSignatureSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (html: string | null) => void;
};

export function EmailSignatureSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: EmailSignatureSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [html, setHtml] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);

  const revokePreviewBlob = useCallback(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setPreviewImageUrl(null);
  }, []);

  const refreshPreview = useCallback(
    async (sourceHtml: string) => {
      revokePreviewBlob();
      if (!/<img\b/i.test(sourceHtml)) return;
      const objectUrl = await createSignaturePreviewImageUrl(sourceHtml);
      if (!objectUrl) return;
      previewBlobRef.current = objectUrl;
      setPreviewImageUrl(objectUrl);
    },
    [revokePreviewBlob],
  );

  const loadSignature = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEmailSignature();
      const nextHtml = res.html ?? '';
      setHtml(nextHtml);
      await refreshPreview(nextHtml);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar la firma');
      setHtml('');
      revokePreviewBlob();
    } finally {
      setLoading(false);
    }
  }, [refreshPreview, revokePreviewBlob]);

  useEffect(() => {
    if (open) void loadSignature();
    return () => revokePreviewBlob();
  }, [open, loadSignature, revokePreviewBlob]);

  useEffect(() => {
    if (!open || loading) return;
    const t = setTimeout(() => {
      void refreshPreview(html);
    }, 300);
    return () => clearTimeout(t);
  }, [html, open, loading, refreshPreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveEmailSignature(html);
      const saved = res.html?.trim() || null;
      onSaved?.(saved);
      toast.success('Firma guardada');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la firma');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteEmailSignature();
      setHtml('');
      revokePreviewBlob();
      onSaved?.(null);
      toast.success('Firma eliminada');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar la firma');
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
      toast.error('La imagen supera el máximo de 6 MB');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadEmailSignatureImage(file);
      setHtml(res.html);
      await refreshPreview(res.html);
      toast.success('Imagen de firma subida');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  const previewText = signatureHtmlWithoutImage(html);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Firma de correo</DialogTitle>
          <DialogDescription>
            Configura tu firma personal. Se guarda en MinIO y se incrusta al enviar el correo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signature-html">Contenido (texto o HTML)</Label>
              <textarea
                id="signature-html"
                rows={5}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={'Ej: Saludos,\nJuan Pérez\nAsesor Comercial'}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleImageChange(e)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || saving}
                onClick={() => imageInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 size-4" />
                )}
                Subir imagen
              </Button>
              <span className="text-xs text-muted-foreground">Máx. 6 MB · JPG, PNG, WebP o GIF</span>
            </div>

            {previewImageUrl || previewText ? (
              <div className="space-y-2">
                <Label>Vista previa</Label>
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                  {previewText ? (
                    <div className="whitespace-pre-wrap">{previewText}</div>
                  ) : null}
                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt="Firma"
                      className="h-auto max-h-32 max-w-full object-contain"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={saving || loading || !html.trim()}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="mr-2 size-4" />
            Eliminar firma
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#13944C] hover:bg-[#0f7a3d]"
              disabled={saving || loading}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
