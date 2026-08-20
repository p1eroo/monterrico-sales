import { useCallback, useEffect, useMemo, useRef } from 'react';
import { sanitize } from 'lettersanitizer';
import { cn } from '@/lib/utils';

const ALLOWED_SCHEMAS = ['http', 'https', 'mailto', 'cid', 'data'];

export type GmailMessageBodyProps = {
  bodyHtml?: string | null;
  bodyText?: string | null;
  /** Compatibilidad con respuestas que solo envían `body`. */
  body?: string | null;
  subject?: string;
  /**
   * `canvas`: fondo blanco (HTML de Gmail).
   * `theme`: se integra con el tema de la app (buzón de campañas).
   */
  tone?: 'canvas' | 'theme';
};

function resolveBodyParts({
  bodyHtml,
  bodyText,
  body,
}: Pick<GmailMessageBodyProps, 'bodyHtml' | 'bodyText' | 'body'>) {
  const html = bodyHtml?.trim() ?? '';
  const text = bodyText?.trim() ?? '';
  if (html || text) {
    return { html, text };
  }
  const fallback = body?.trim() ?? '';
  if (!fallback) {
    return { html: '', text: '' };
  }
  if (/<[a-z][\s\S]*>/i.test(fallback)) {
    return { html: fallback, text: '' };
  }
  return { html: '', text: fallback };
}

const CANVAS_CSS = `
  html, body {
    margin: 0;
    padding: 0;
    height: auto;
    min-height: 0;
    background: #ffffff;
    color: #202124;
    font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  body { padding: 2px 0 8px; }
  img { max-width: 100%; height: auto; }
  a { color: #1a73e8; }
  p { margin: 0 0 0.8em; }
  p:last-child { margin-bottom: 0; }
  table { max-width: 100%; }
`;

function stripLightOnDarkInlineStyles(html: string) {
  return html
    .replace(
      /\s*color\s*:\s*(#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*[\d.]+\s*\))\s*;?/gi,
      '',
    )
    .replace(
      /\s*background(?:-color)?\s*:\s*(#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*[\d.]+\s*\))\s*;?/gi,
      '',
    );
}

function wrapCanvasSrcDoc(inner: string) {
  const styleTag = `<style data-crm-mail>${CANVAS_CSS}</style>`;
  if (/<head[\s>]/i.test(inner)) {
    return inner.replace(/<head([^>]*)>/i, `<head$1>${styleTag}`);
  }
  if (/<html[\s>]/i.test(inner)) {
    return inner.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${styleTag}</head><body>${inner}</body></html>`;
}

export function GmailMessageBody({
  bodyHtml,
  bodyText,
  body,
  subject,
  tone = 'canvas',
}: GmailMessageBodyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { html, text } = useMemo(
    () => resolveBodyParts({ bodyHtml, bodyText, body }),
    [bodyHtml, bodyText, body],
  );

  const sanitizedHtml = useMemo(() => {
    const raw = sanitize(html, text, { allowedSchemas: ALLOWED_SCHEMAS });
    return tone === 'theme' ? stripLightOnDarkInlineStyles(raw) : raw;
  }, [html, text, tone]);

  const srcDoc = useMemo(
    () => (tone === 'canvas' ? wrapCanvasSrcDoc(sanitizedHtml) : ''),
    [sanitizedHtml, tone],
  );

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    iframe.style.height = '0px';
    const height = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      24,
    );
    iframe.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    if (tone !== 'canvas') return undefined;
    resizeIframe();
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return undefined;

    const observer = new ResizeObserver(() => resizeIframe());
    observer.observe(doc.body);
    if (doc.documentElement) observer.observe(doc.documentElement);

    return () => observer.disconnect();
  }, [srcDoc, resizeIframe, tone]);

  if (!html && !text) {
    return <p className="text-sm text-muted-foreground italic">(Sin contenido)</p>;
  }

  if (!sanitizedHtml.trim()) {
    return <p className="text-sm text-muted-foreground italic">(Sin contenido)</p>;
  }

  if (tone === 'theme') {
    return (
      <div
        className="campaign-mail-body max-w-full overflow-x-auto text-[15px] leading-[1.55] text-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  return (
    <div className={cn('max-w-full overflow-hidden rounded-md bg-white')}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title={subject?.trim() || 'Contenido del correo'}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        referrerPolicy="no-referrer"
        className="w-full border-0 bg-white [color-scheme:light]"
        onLoad={resizeIframe}
      />
    </div>
  );
}
