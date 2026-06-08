import DOMPurify from 'dompurify';

/** Convierte texto plano (plantillas legacy) a HTML seguro para el editor de email */
export function plainTextToHtmlForEmail(text: string): string {
  const t = text.trim();
  if (!t) return '<p></p>';
  if (t.startsWith('<')) return text;
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const inner = block.split('\n').map((line) => esc(line)).join('<br>');
      return `<p>${inner || '<br>'}</p>`;
    })
    .join('');
}

/** Pasa de HTML a texto al cambiar a SMS / WhatsApp */
export function htmlToPlainText(html: string): string {
  if (!html || !html.includes('<')) return html;
  const d = new DOMParser().parseFromString(html, 'text/html');
  return d.body.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
}

/** Cuerpo vacío: sin texto visible (email HTML o texto plano) */
export function isCampaignBodyEmpty(channel: 'email' | 'sms' | 'whatsapp', body: string): boolean {
  if (channel !== 'email') return !body.trim();
  if (!body.trim()) return true;
  const d = new DOMParser().parseFromString(body, 'text/html');
  return !d.body.textContent?.trim();
}

/** Vista previa de email: HTML tras variables, sanitizado */
export function sanitizeCampaignEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['style', 'target', 'rel'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}
