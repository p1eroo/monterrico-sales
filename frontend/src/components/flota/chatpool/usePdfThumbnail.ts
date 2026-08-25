import { useEffect, useState } from 'react';
import { isPdfContent, renderPdfThumbnail } from './pdfUtils';

const THUMBNAIL_WIDTH = 330;

export function usePdfThumbnail(blob: Blob | null) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!blob) {
      setThumbnailUrl(null);
      setPageCount(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(false);
    setThumbnailUrl(null);
    setPageCount(null);

    void (async () => {
      try {
        const validPdf = await isPdfContent(blob);
        if (!validPdf) {
          if (!cancelled) setError(true);
          return;
        }

        const result = await renderPdfThumbnail(blob, THUMBNAIL_WIDTH);
        if (cancelled) return;

        setThumbnailUrl(result.dataUrl);
        setPageCount(result.numPages);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  return { thumbnailUrl, pageCount, loading, error };
}
