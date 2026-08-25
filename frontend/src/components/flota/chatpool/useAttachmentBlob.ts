import { useEffect, useState } from 'react';
import { fetchAttachmentBlob } from './messageAttachments';

export function useAttachmentBlob(params: {
  attachmentId?: string | null;
  fileUrl?: string | null;
  enabled?: boolean;
}) {
  const { attachmentId, fileUrl, enabled = true } = params;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || (!attachmentId && !fileUrl)) {
      setBlob(null);
      setObjectUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);
    setBlob(null);
    setObjectUrl(null);

    void fetchAttachmentBlob({ attachmentId, fileUrl })
      .then((nextBlob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(nextBlob);
        setBlob(nextBlob);
        setObjectUrl(createdUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'No se pudo cargar el archivo';
        setError(message);
        setBlob(null);
        setObjectUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachmentId, fileUrl, enabled]);

  return { blob, objectUrl, loading, error };
}
