export type InlineEmailImage = {
  cid: string;
  mimeType: string;
  content: Buffer;
  fileName: string;
};

const SIGNATURE_IMAGE_PLACEHOLDER = '__CRM_SIGNATURE_IMAGE__';

async function resolveImageBuffer(
  src: string,
): Promise<{ mimeType: string; content: Buffer } | null> {
  if (src.startsWith('cid:')) return null;

  if (src.startsWith('data:')) {
    const match = src.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/i);
    if (!match) return null;
    try {
      const content = Buffer.from(match[2], 'base64');
      if (!content.length) return null;
      return { mimeType: match[1].trim(), content };
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) return null;
      const content = Buffer.from(await res.arrayBuffer());
      if (!content.length) return null;
      const mimeType = (res.headers.get('content-type') || 'image/png')
        .split(';')[0]
        .trim();
      return { mimeType, content };
    } catch {
      return null;
    }
  }

  return null;
}

function mimeToExt(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes('gif')) return 'gif';
  if (m.includes('webp')) return 'webp';
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  return 'bin';
}

function appendBase64Lines(lines: string[], buffer: Buffer): void {
  const b64 = buffer.toString('base64');
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
}

export async function embedInlineImagesInHtml(
  html: string,
  resolveFallback?: (
    src: string,
  ) => Promise<{ mimeType: string; content: Buffer } | null>,
): Promise<{ html: string; inlineImages: InlineEmailImage[] }> {
  const inlineImages: InlineEmailImage[] = [];
  const regex = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/gi;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(html)) !== null) {
    result += html.slice(lastIndex, match.index);
    const [, before, src, after] = match;

    let resolved: { mimeType: string; content: Buffer } | null = null;
    if (
      resolveFallback &&
      (src === SIGNATURE_IMAGE_PLACEHOLDER ||
        /crm-avatar|cdn\.3w\.pe|email-signatures/i.test(src))
    ) {
      resolved = await resolveFallback(src);
    }
    if (!resolved) {
      resolved = await resolveImageBuffer(src);
    }
    if (!resolved && resolveFallback) {
      resolved = await resolveFallback(src);
    }

    if (resolved) {
      const cid = `img_${idx++}_${Date.now().toString(36)}`;
      const ext = mimeToExt(resolved.mimeType);
      inlineImages.push({
        cid,
        mimeType: resolved.mimeType,
        content: resolved.content,
        fileName: `inline-${cid}.${ext}`,
      });
      result += `<img${before}src="cid:${cid}"${after}>`;
    } else {
      result += match[0];
    }

    lastIndex = regex.lastIndex;
  }

  result += html.slice(lastIndex);
  return { html: result, inlineImages };
}

export function buildMultipartEmailLines(params: {
  to: string;
  cc?: string;
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
  attachments: { fileName: string; mimeType: string; content: Buffer }[];
  inlineImages: InlineEmailImage[];
}): string[] {
  const lines: string[] = [];
  lines.push('From: me');
  lines.push(`To: ${params.to}`);
  if (params.cc) lines.push(`Cc: ${params.cc}`);
  lines.push(`Subject: ${params.subject}`);
  if (params.inReplyTo) {
    const ref = params.inReplyTo.startsWith('<')
      ? params.inReplyTo
      : `<${params.inReplyTo}>`;
    lines.push(`In-Reply-To: ${ref}`);
    lines.push(`References: ${ref}`);
  }
  lines.push('MIME-Version: 1.0');

  const hasInline = params.inlineImages.length > 0;
  const hasAttach = params.attachments.length > 0;

  if (!hasInline && !hasAttach) {
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('');
    lines.push(params.bodyHtml);
    return lines;
  }

  const pushHtmlPart = (boundary: string) => {
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=utf-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(params.bodyHtml);
  };

  const pushInlineParts = (boundary: string) => {
    for (const img of params.inlineImages) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${img.mimeType}; name="${img.fileName}"`);
      lines.push(`Content-Disposition: inline; filename="${img.fileName}"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push(`Content-ID: <${img.cid}>`);
      lines.push('');
      appendBase64Lines(lines, img.content);
    }
  };

  const pushAttachmentParts = (boundary: string) => {
    for (const att of params.attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${att.mimeType}; name="${att.fileName}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.fileName}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      appendBase64Lines(lines, att.content);
    }
  };

  if (hasInline && !hasAttach) {
    const boundary = `related_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    lines.push(`Content-Type: multipart/related; boundary="${boundary}"`);
    lines.push('');
    pushHtmlPart(boundary);
    pushInlineParts(boundary);
    lines.push(`--${boundary}--`);
    return lines;
  }

  if (!hasInline && hasAttach) {
    const boundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    pushHtmlPart(boundary);
    pushAttachmentParts(boundary);
    lines.push(`--${boundary}--`);
    return lines;
  }

  const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const relatedBoundary = `related_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
  lines.push('');
  lines.push(`--${mixedBoundary}`);
  lines.push(`Content-Type: multipart/related; boundary="${relatedBoundary}"`);
  lines.push('');
  pushHtmlPart(relatedBoundary);
  pushInlineParts(relatedBoundary);
  lines.push(`--${relatedBoundary}--`);
  pushAttachmentParts(mixedBoundary);
  lines.push(`--${mixedBoundary}--`);
  return lines;
}
