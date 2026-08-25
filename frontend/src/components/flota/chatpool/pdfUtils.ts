import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export { pdfjs };

export function isPdfFile(fileName: string, mimeType?: string | null): boolean {
  if (mimeType?.toLowerCase().includes('pdf')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext === 'pdf';
}

export async function isPdfContent(blob: Blob): Promise<boolean> {
  const header = await blob.slice(0, 5).text();
  return header.startsWith('%PDF');
}

export async function loadPdfDocument(blob: Blob): Promise<PDFDocumentProxy> {
  const data = await blob.arrayBuffer();
  return pdfjs.getDocument({ data }).promise;
}

function isRenderCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name?.toLowerCase() ?? '';
  const message = error.message?.toLowerCase() ?? '';
  return (
    name.includes('renderingcancelled') ||
    name.includes('abort') ||
    message.includes('cancel') ||
    message.includes('abort')
  );
}

export async function renderPdfPageToCanvas(params: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  canvas: HTMLCanvasElement;
  signal?: AbortSignal;
}): Promise<{ width: number; height: number; task: RenderTask }> {
  if (params.signal?.aborted) {
    throw new DOMException('Render aborted', 'AbortError');
  }

  const page = await params.pdf.getPage(params.pageNumber);
  const viewport = page.getViewport({ scale: params.scale });
  const context = params.canvas.getContext('2d');

  if (!context) {
    throw new Error('No se pudo renderizar el PDF');
  }

  const outputScale = window.devicePixelRatio || 1;
  const pixelWidth = Math.floor(viewport.width * outputScale);
  const pixelHeight = Math.floor(viewport.height * outputScale);

  params.canvas.width = pixelWidth;
  params.canvas.height = pixelHeight;
  params.canvas.style.width = `${Math.floor(viewport.width)}px`;
  params.canvas.style.height = `${Math.floor(viewport.height)}px`;

  context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  const task = page.render({ canvasContext: context, viewport, canvas: params.canvas });

  const abortHandler = () => task.cancel();
  params.signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    await task.promise;
  } catch (error) {
    if (params.signal?.aborted || isRenderCancelled(error)) {
      throw new DOMException('Render aborted', 'AbortError');
    }
    throw error;
  } finally {
    params.signal?.removeEventListener('abort', abortHandler);
  }

  return {
    width: viewport.width,
    height: viewport.height,
    task,
  };
}

const STANDARD_MAX_WIDTH = 800;
const DEFAULT_ZOOM_BOOST = 1.12;

export async function getPdfFitScale(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  containerWidth: number,
): Promise<number> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.min(Math.max(containerWidth - 96, 320), STANDARD_MAX_WIDTH);

  const fitScale = viewport.width <= availableWidth ? 1 : availableWidth / viewport.width;

  return Math.min(fitScale * DEFAULT_ZOOM_BOOST, availableWidth / viewport.width);
}

export async function renderPdfThumbnail(
  blob: Blob,
  maxWidth: number,
): Promise<{ dataUrl: string; numPages: number }> {
  const pdf = await loadPdfDocument(blob);
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo crear el lienzo de vista previa');
  }

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.82),
    numPages: pdf.numPages,
  };
}
