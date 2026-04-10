type JsonRecord = Record<string, unknown>;

function asRecord(v: unknown): JsonRecord | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as JsonRecord)
    : null;
}

export function jidUserDigits(raw: unknown): string {
  if (typeof raw === 'string') {
    const head = raw.split('@')[0] ?? '';
    return head.replace(/\D/g, '');
  }
  const o = asRecord(raw);
  if (o && typeof o['User'] === 'string') {
    return String(o['User']).replace(/\D/g, '');
  }
  return '';
}

/** Extrae texto legible del objeto `Message` serializado por Evolution GO. */
export function extractMessageCaption(msg: JsonRecord): string {
  if (typeof msg['conversation'] === 'string') {
    return msg['conversation'];
  }
  const ext = asRecord(msg['extendedTextMessage']);
  if (ext && typeof ext['text'] === 'string') {
    return ext['text'];
  }
  for (const key of ['imageMessage', 'videoMessage', 'documentMessage'] as const) {
    const inner = asRecord(msg[key]);
    if (inner && typeof inner['caption'] === 'string' && inner['caption'].trim()) {
      return inner['caption'];
    }
  }
  if (asRecord(msg['imageMessage'])) return '[Imagen]';
  if (asRecord(msg['videoMessage'])) return '[Video]';
  if (asRecord(msg['audioMessage'])) return '[Audio]';
  if (asRecord(msg['documentMessage'])) return '[Documento]';
  if (asRecord(msg['stickerMessage'])) return '[Sticker]';
  return '';
}

export function readMessageEventPayload(body: unknown): {
  event: string;
  instanceId: string;
  instanceName: string | null;
  instanceToken: string | null;
  data: JsonRecord;
} | null {
  const root = asRecord(body);
  if (!root || typeof root['event'] !== 'string') return null;
  const data = asRecord(root['data']);
  if (!data) return null;
  return {
    event: root['event'],
    instanceId:
      typeof root['instanceId'] === 'string' ? root['instanceId'] : '',
    instanceName:
      typeof root['instanceName'] === 'string' ? root['instanceName'] : null,
    instanceToken:
      typeof root['instanceToken'] === 'string' ? root['instanceToken'] : null,
    data,
  };
}

/** Campos útiles del evento `Message` de whatsmeow serializado a JSON. */
export function parseMessageEventData(data: JsonRecord): {
  isFromMe: boolean;
  waMessageId: string | null;
  chatDigits: string;
  senderDigits: string;
  isGroup: boolean;
  text: string;
} {
  const info = asRecord(data['Info']) ?? asRecord(data['info']) ?? {};
  const isFromMe = Boolean(info['IsFromMe'] ?? info['isFromMe']);
  const idRaw = info['ID'] ?? info['id'] ?? info['Id'];
  const waMessageId =
    typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : null;

  const chatRaw = info['Chat'] ?? info['chat'];
  const senderRaw = info['Sender'] ?? info['sender'];
  const chatJid = jidUserDigits(chatRaw);
  const senderJid = jidUserDigits(senderRaw);
  const chatStr = typeof chatRaw === 'string' ? chatRaw : '';
  const isGroup = chatStr.includes('@g.us');

  const msg =
    asRecord(data['Message']) ?? asRecord(data['message']) ?? {};
  const text = extractMessageCaption(msg);

  return {
    isFromMe,
    waMessageId,
    chatDigits: chatJid,
    senderDigits: senderJid || chatJid,
    isGroup,
    text,
  };
}

/** Elimina campos pesados (p. ej. base64) antes de guardar JSON en BD. */
export function stripHeavyPayload(node: unknown, depth = 0): unknown {
  if (depth > 12) return '[depth]';
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) {
    return node.map((x) => stripHeavyPayload(x, depth + 1));
  }
  if (typeof node !== 'object') return node;
  const out: JsonRecord = {};
  for (const [k, v] of Object.entries(node as JsonRecord)) {
    const keyLow = k.toLowerCase();
    if (
      keyLow === 'base64' ||
      keyLow === 'jpegthumbnail' ||
      keyLow === 'fileencsha256' ||
      keyLow === 'mediakeytimestamp'
    ) {
      out[k] = '[stripped]';
      continue;
    }
    out[k] = stripHeavyPayload(v, depth + 1);
  }
  return out;
}
