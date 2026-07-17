import { useCallback, useEffect, useMemo, useRef } from 'react';
import { sanitize } from 'lettersanitizer';

const ALLOWED_SCHEMAS = ['http', 'https', 'mailto', 'cid', 'data'];

export type GmailMessageBodyProps = {
  bodyHtml?: string | null;
  bodyText?: string | null;
  /** Compatibilidad con respuestas que solo envían `body`. */
  body?: string | null;
  subject?: string;
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

export function GmailMessageBody({
  bodyHtml,
  bodyText,
  body,
  subject,
}: GmailMessageBodyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { html, text } = useMemo(
    () => resolveBodyParts({ bodyHtml, bodyText, body }),
    [bodyHtml, bodyText, body],
  );

  const sanitizedHtml = useMemo(
    () => sanitize(html, text, { allowedSchemas: ALLOWED_SCHEMAS }),
    [html, text],
  );

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    const height = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      120,
    );
    iframe.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    resizeIframe();
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return undefined;

    const observer = new ResizeObserver(() => resizeIframe());
    observer.observe(doc.body);
    if (doc.documentElement) observer.observe(doc.documentElement);

    return () => observer.disconnect();
  }, [sanitizedHtml, resizeIframe]);

  if (!html && !text) {
    return <p className="text-sm text-muted-foreground italic">(Sin contenido)</p>;
  }

  if (!sanitizedHtml.trim()) {
    return <p className="text-sm text-muted-foreground italic">(Sin contenido)</p>;
  }

  return (
    <div className="max-w-full overflow-hidden rounded-md bg-white">
      <iframe
        ref={iframeRef}
        srcDoc={sanitizedHtml}
        title={subject?.trim() || 'Contenido del correo'}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        referrerPolicy="no-referrer"
        className="w-full border-0"
        onLoad={resizeIframe}
      />
    </div>
  );
}
