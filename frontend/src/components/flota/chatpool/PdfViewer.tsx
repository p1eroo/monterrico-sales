import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Printer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { downloadFile } from './messageAttachments';
import { useAttachmentBlob } from './useAttachmentBlob';
import {
  getPdfFitScale,
  isPdfContent,
  isPdfFile,
  loadPdfDocument,
  renderPdfPageToCanvas,
} from './pdfUtils';
import { useChatpoolStore } from './store';
import type { Message } from './types';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
const SCALE_STEP = 0.15;

function getPdfFileName(message: Message): string {
  return message.fileName || message.content || 'Documento.pdf';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function PdfViewer() {
  const pdfViewerMessageId = useChatpoolStore((s) => s.pdfViewerMessageId);
  const closePdfViewer = useChatpoolStore((s) => s.closePdfViewer);
  const openPdfViewer = useChatpoolStore((s) => s.openPdfViewer);
  const activeConversationId = useChatpoolStore((s) => s.activeConversationId);
  const allMessages = useChatpoolStore((s) => s.messages);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const pdfMessages = useMemo(() => {
    if (!activeConversationId) return [];
    const messages = allMessages[activeConversationId] || [];
    return messages.filter((message) => {
      if (message.contentType === 'image' || message.contentType === 'audio') return false;
      const fileName = message.fileName || message.content;
      return (
        isPdfFile(fileName, message.mimeType) &&
        Boolean(message.fileUrl || message.attachmentUrl || message.attachmentId)
      );
    });
  }, [activeConversationId, allMessages]);

  const currentIndex = useMemo(() => {
    if (!pdfViewerMessageId) return -1;
    return pdfMessages.findIndex((message) => message.id === pdfViewerMessageId);
  }, [pdfMessages, pdfViewerMessageId]);

  const currentMessage = currentIndex >= 0 ? pdfMessages[currentIndex] : null;

  const resolvedUrl = currentMessage?.fileUrl || currentMessage?.attachmentUrl || null;
  const { blob, objectUrl, loading, error } = useAttachmentBlob({
    attachmentId: currentMessage?.attachmentId,
    fileUrl: resolvedUrl,
    enabled: Boolean(currentMessage),
  });

  useEffect(() => {
    setPdfDoc(null);
    setPageNumber(1);
    setNumPages(0);
    setScale(1);
    setLoadError(null);
    setRenderError(null);

    if (!blob) return;

    let cancelled = false;

    void (async () => {
      try {
        const valid = await isPdfContent(blob);
        if (!valid) {
          if (!cancelled) {
            setLoadError('El archivo no es un PDF válido o ya no está disponible.');
          }
          return;
        }

        const doc = await loadPdfDocument(blob);
        if (cancelled) return;

        const containerWidth = viewportRef.current?.clientWidth ?? window.innerWidth;
        const fitScale = await getPdfFitScale(doc, 1, containerWidth);

        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setScale(fitScale);
      } catch {
        if (!cancelled) {
          setLoadError('No se pudo abrir el documento.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, pdfViewerMessageId]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDoc || !canvas) return;

    const controller = new AbortController();
    setRendering(true);
    setRenderError(null);

    void renderPdfPageToCanvas({
      pdf: pdfDoc,
      pageNumber,
      scale,
      canvas,
      signal: controller.signal,
    })
      .catch((err) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setRenderError('No se pudo mostrar esta página.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRendering(false);
      });

    return () => {
      controller.abort();
    };
  }, [pdfDoc, pageNumber, scale]);

  useEffect(() => {
    if (!pdfViewerMessageId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePdfViewer();
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setPageNumber((value) => Math.max(1, value - 1));
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        setPageNumber((value) => Math.min(numPages || value, value + 1));
      }

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        openPdfViewer(pdfMessages[currentIndex - 1].id);
      }

      if (e.key === 'ArrowRight' && currentIndex < pdfMessages.length - 1) {
        openPdfViewer(pdfMessages[currentIndex + 1].id);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    pdfViewerMessageId,
    closePdfViewer,
    currentIndex,
    pdfMessages,
    openPdfViewer,
    numPages,
  ]);

  if (!pdfViewerMessageId || !currentMessage) return null;

  const fileName = getPdfFileName(currentMessage);
  const hasPrevDoc = currentIndex > 0;
  const hasNextDoc = currentIndex < pdfMessages.length - 1;
  const hasPrevPage = pageNumber > 1;
  const hasNextPage = numPages > 0 && pageNumber < numPages;
  const blockingError = error ?? loadError;

  const goPrevDoc = () => {
    if (!hasPrevDoc) return;
    openPdfViewer(pdfMessages[currentIndex - 1].id);
  };

  const goNextDoc = () => {
    if (!hasNextDoc) return;
    openPdfViewer(pdfMessages[currentIndex + 1].id);
  };

  const handleDownload = () => {
    if (downloading || !currentMessage) return;
    setDownloading(true);
    void downloadFile({
      fileName,
      attachmentId: currentMessage.attachmentId,
      fileUrl: currentMessage.fileUrl || currentMessage.attachmentUrl,
    })
      .catch((err) => {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : 'No se pudo descargar el documento',
        );
      })
      .finally(() => setDownloading(false));
  };

  const handlePrint = () => {
    if (printing || !objectUrl) return;
    setPrinting(true);

    const iframe = document.createElement('iframe');
    iframe.className = 'pointer-events-none fixed inset-0 h-0 w-0 border-0 opacity-0';
    iframe.src = objectUrl;

    const cleanup = () => {
      iframe.remove();
      setPrinting(false);
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        toast.error('No se pudo abrir el diálogo de impresión');
        cleanup();
        return;
      }

      window.setTimeout(cleanup, 1_000);
    };

    iframe.onerror = () => {
      toast.error('No se pudo imprimir el documento');
      cleanup();
    };

    document.body.appendChild(iframe);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-[#2a2a2a]">
      <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center border-b border-white/8 bg-[#1f1f1f]/95 px-4 md:px-5">
        <p className="min-w-0 flex-1 truncate pr-4 text-sm font-medium text-white/90">{fileName}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarButton
            title={downloading ? 'Descargando…' : 'Descargar'}
            onClick={handleDownload}
            disabled={downloading || Boolean(blockingError)}
          >
            <Download className="h-[18px] w-[18px]" />
          </ToolbarButton>
          <ToolbarButton
            title={printing ? 'Preparando…' : 'Imprimir'}
            onClick={handlePrint}
            disabled={printing || !objectUrl || Boolean(blockingError)}
          >
            <Printer className="h-[18px] w-[18px]" />
          </ToolbarButton>
          <ToolbarButton title="Cerrar" onClick={closePdfViewer}>
            <X className="h-[18px] w-[18px]" />
          </ToolbarButton>
        </div>
      </div>

      {hasPrevDoc ? (
        <button
          type="button"
          onClick={goPrevDoc}
          className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/90 transition-colors hover:bg-black/65"
          title="Documento anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}

      {hasNextDoc ? (
        <button
          type="button"
          onClick={goNextDoc}
          className="absolute right-[4.5rem] top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/90 transition-colors hover:bg-black/65"
          title="Documento siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}

      <div
        ref={viewportRef}
        className="flex h-full items-start justify-center overflow-auto px-4 pb-6 pt-16 md:px-10"
      >
        {(loading || (blob && !pdfDoc && !blockingError)) && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm">Cargando documento…</p>
          </div>
        )}

        {!loading && blockingError ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="max-w-sm rounded-xl bg-black/40 px-6 py-5 text-center text-white/90">
              <p className="text-sm">{blockingError}</p>
            </div>
          </div>
        ) : null}

        {!blockingError && pdfDoc ? (
          <div className="relative my-6 flex w-full max-w-[800px] justify-center">
            <canvas
              ref={canvasRef}
              className={cn(
                'max-w-full bg-white shadow-2xl transition-opacity duration-150',
                rendering && 'opacity-70',
              )}
            />
            {renderError ? (
              <div className="absolute inset-x-0 top-3 flex justify-center">
                <div className="rounded-full bg-black/70 px-3 py-1 text-xs text-white/90">
                  {renderError}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!loading && !blockingError && numPages > 0 ? (
        <div className="absolute bottom-8 right-4 z-20 flex flex-col items-center gap-1 rounded-2xl bg-[#3a3a3a]/95 px-2 py-3 shadow-lg backdrop-blur-sm">
          <div className="mb-1 flex flex-col items-center text-[11px] leading-none text-white/90">
            <span className="text-base font-medium tabular-nums">{pageNumber}</span>
            <span className="my-0.5 h-px w-4 bg-white/25" />
            <span className="tabular-nums text-white/55">{numPages}</span>
          </div>

          <SideButton
            title="Página anterior"
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            disabled={!hasPrevPage}
          >
            <ChevronUp className="h-4 w-4" />
          </SideButton>

          <SideButton
            title="Página siguiente"
            onClick={() => setPageNumber((value) => Math.min(numPages, value + 1))}
            disabled={!hasNextPage}
          >
            <ChevronDown className="h-4 w-4" />
          </SideButton>

          <div className="my-1 h-px w-6 bg-white/15" />

          <SideButton
            title="Acercar"
            onClick={() => setScale((value) => Math.min(MAX_SCALE, value + SCALE_STEP))}
          >
            <ZoomIn className="h-4 w-4" />
          </SideButton>

          <SideButton
            title="Alejar"
            onClick={() => setScale((value) => Math.max(MIN_SCALE, value - SCALE_STEP))}
          >
            <ZoomOut className="h-4 w-4" />
          </SideButton>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function ToolbarButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

function SideButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white',
        disabled && 'cursor-not-allowed opacity-35 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}
