type JsonRecord = Record<string, unknown>;
export type WhatsappParsedMedia = {
  mediaType: 'image' | 'video' | 'audio' | 'document';
  url: string | null;
  base64: string | null;
  mimeType: string | null;
  fileName: string | null;
  size: number | null;
  caption: string | null;
};

function asRecord(v: unknown): JsonRecord | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as JsonRecord)
    : null;
}

function unwrapMessageContainer(node: JsonRecord): JsonRecord {
  let current = node;
  for (let depth = 0; depth < 8; depth++) {
    const nested =
      asRecord(current['ephemeralMessage'])?.['message'] ??
      asRecord(current['viewOnceMessage'])?.['message'] ??
      asRecord(current['viewOnceMessageV2'])?.['message'] ??
      asRecord(current['viewOnceMessageV2Extension'])?.['message'] ??
      asRecord(current['documentWithCaptionMessage'])?.['message'] ??
      asRecord(current['editedMessage'])?.['message'] ??
      asRecord(current['deviceSentMessage'])?.['message'];
    const next = asRecord(nested);
    if (!next) return current;
    current = next;
  }
  return current;
}

function rootMessageNode(data: JsonRecord): JsonRecord {
  return unwrapMessageContainer(
    asRecord(data['Message']) ?? asRecord(data['message']) ?? {},
  );
}

function readStringField(
  node: JsonRecord | null,
  keys: string[],
): string | null {
  if (!node) return null;
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickMediaNode(
  msg: JsonRecord,
  lowerKey: 'imageMessage' | 'videoMessage' | 'audioMessage' | 'documentMessage',
): JsonRecord | null {
  const upperKey = `${lowerKey[0]!.toUpperCase()}${lowerKey.slice(1)}`;
  return asRecord(msg[lowerKey]) ?? asRecord(msg[upperKey]);
}

function pickEnvelopeBase64(data: JsonRecord, msg: JsonRecord): string | null {
  const topLevel = readStringField(data, ['base64', 'Base64']);
  if (topLevel) return topLevel;
  const nestedMessages = Array.isArray(data['messages'])
    ? data['messages']
    : Array.isArray(data['Messages'])
      ? data['Messages']
      : null;
  const firstMessage = nestedMessages?.[0] ? asRecord(nestedMessages[0]) : null;
  const wrapped = readStringField(firstMessage, ['base64', 'Base64']);
  if (wrapped) return wrapped;
  return readStringField(msg, ['base64', 'Base64']);
}

export function resolveEvolutionMediaUrl(
  raw: string | null | undefined,
  baseUrl: string | null | undefined,
): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  const base = (baseUrl || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(value)) {
    if (!base) return value;
    return value.replace(/^https?:\/\/(localhost|127\.0\.0\.1):8080\b/i, base);
  }
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) {
    return base ? `${base}${value}` : value;
  }
  return value;
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
  const resolved = unwrapMessageContainer(msg);
  if (typeof resolved['conversation'] === 'string') {
    return resolved['conversation'];
  }
  const ext = asRecord(resolved['extendedTextMessage']);
  if (ext && typeof ext['text'] === 'string') {
    return ext['text'];
  }
  for (const key of ['imageMessage', 'videoMessage', 'documentMessage'] as const) {
    const inner = pickMediaNode(resolved, key);
    const caption = readStringField(inner, ['caption', 'Caption']);
    if (caption) {
      return caption;
    }
  }
  if (pickMediaNode(resolved, 'imageMessage')) return '[Imagen]';
  if (pickMediaNode(resolved, 'videoMessage')) return '[Video]';
  if (pickMediaNode(resolved, 'audioMessage')) return '[Audio]';
  if (pickMediaNode(resolved, 'documentMessage')) return '[Documento]';
  if (asRecord(resolved['stickerMessage']) || asRecord(resolved['StickerMessage'])) return '[Sticker]';
  return '';
}

/** Cuerpo webhook Evolution / whatsmeow (event + data sin exigir forma de `data`). */
export function readEvolutionWebhookEvent(body: unknown): {
  event: string;
  instanceId: string;
  instanceName: string | null;
  instanceToken: string | null;
  data: unknown;
} | null {
  const root = asRecord(body);
  if (!root) return null;
  const nestedInstance = asRecord(root['instance']);
  const nestedInstanceUpper = asRecord(root['Instance']);
  const rootData = asRecord(root['data']) ?? asRecord(root['Data']);
  const event =
    typeof root['event'] === 'string'
      ? root['event']
      : typeof root['Event'] === 'string'
        ? root['Event']
        : null;
  if (!event) return null;
  return {
    event,
    instanceId:
      typeof root['instanceId'] === 'string'
        ? root['instanceId']
        : typeof root['InstanceId'] === 'string'
          ? root['InstanceId']
          : typeof nestedInstance?.['instanceId'] === 'string'
            ? nestedInstance['instanceId']
            : typeof nestedInstanceUpper?.['instanceId'] === 'string'
              ? nestedInstanceUpper['instanceId']
              : '',
    instanceName:
      typeof root['instanceName'] === 'string'
        ? root['instanceName']
        : typeof root['InstanceName'] === 'string'
          ? root['InstanceName']
          : typeof root['instance'] === 'string'
            ? root['instance']
          : typeof nestedInstance?.['instanceName'] === 'string'
            ? nestedInstance['instanceName']
            : typeof nestedInstance?.['name'] === 'string'
              ? nestedInstance['name']
              : typeof nestedInstanceUpper?.['instanceName'] === 'string'
                ? nestedInstanceUpper['instanceName']
                : typeof nestedInstanceUpper?.['name'] === 'string'
                  ? nestedInstanceUpper['name']
                  : typeof rootData?.['instanceName'] === 'string'
                    ? rootData['instanceName']
                    : typeof rootData?.['instance'] === 'string'
                      ? rootData['instance']
                  : null,
    instanceToken:
      typeof root['instanceToken'] === 'string'
        ? root['instanceToken']
        : typeof root['InstanceToken'] === 'string'
          ? root['InstanceToken']
          : typeof root['apikey'] === 'string'
            ? root['apikey']
            : null,
    data: root['data'] ?? root['Data'],
  };
}

export function readMessageEventPayload(body: unknown): {
  event: string;
  instanceId: string;
  instanceName: string | null;
  instanceToken: string | null;
  data: JsonRecord;
} | null {
  const base = readEvolutionWebhookEvent(body);
  if (!base) return null;
  const data = asRecord(base.data);
  if (!data) return null;
  return {
    event: base.event,
    instanceId:
      base.instanceId ||
      (typeof data['instanceId'] === 'string' ? data['instanceId'] : '') ||
      (typeof data['InstanceId'] === 'string' ? data['InstanceId'] : ''),
    instanceName:
      base.instanceName ||
      (typeof data['instanceName'] === 'string'
        ? data['instanceName']
        : typeof data['instance'] === 'string'
          ? data['instance']
          : null),
    instanceToken: base.instanceToken,
    data,
  };
}

/** Evento whatsmeow `Receipt`: MessageIDs + Type (Delivered, Read, …). */
export function parseReceiptEventData(data: JsonRecord): {
  messageIds: string[];
  outboundStatus: 'delivered' | 'read' | null;
} {
  const messageIds: string[] = [];
  const rawIds = data['MessageIDs'] ?? data['messageIDs'];
  if (Array.isArray(rawIds)) {
    for (const x of rawIds) {
      if (typeof x === 'string' && x.length > 0) messageIds.push(x);
    }
  }
  const idSingle = data['ID'] ?? data['id'];
  if (typeof idSingle === 'string' && idSingle.length > 0) {
    messageIds.push(idSingle);
  }

  const typeRaw = data['Type'] ?? data['type'] ?? '';
  const t = String(typeRaw).toLowerCase();
  let outboundStatus: 'delivered' | 'read' | null = null;
  if (t.includes('deliver')) outboundStatus = 'delivered';
  else if (t.includes('read')) outboundStatus = 'read';

  return { messageIds, outboundStatus };
}

/**
 * Evolution API v2 estilo Baileys: `MESSAGES_UPDATE` / `messages.update`
 * con `key.id`, `key.fromMe`, `update.status` o `status`.
 */
export function parseMessagesUpdateEventData(data: JsonRecord): {
  waMessageId: string | null;
  fromMe: boolean;
  outboundStatus: 'delivered' | 'read' | null;
} {
  const key = asRecord(data['key']);
  const waMessageId =
    key && typeof key['id'] === 'string' && key['id'].length > 0
      ? key['id']
      : null;
  const fromMe = Boolean(key?.['fromMe']);

  const upd = asRecord(data['update']) ?? {};
  const statusRaw = upd['status'] ?? data['status'];
  let outboundStatus: 'delivered' | 'read' | null = null;
  if (typeof statusRaw === 'number') {
    if (statusRaw === 3) outboundStatus = 'delivered';
    else if (statusRaw === 4 || statusRaw === 5) outboundStatus = 'read';
  } else if (typeof statusRaw === 'string') {
    const s = statusRaw.toLowerCase();
    if (s.includes('deliver') || s === 'delivery_ack') outboundStatus = 'delivered';
    else if (s === 'read' || s.includes('read')) outboundStatus = 'read';
  }

  return { waMessageId, fromMe, outboundStatus };
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
  const key = asRecord(data['key']);
  const isFromMe = Boolean(info['IsFromMe'] ?? info['isFromMe'] ?? key?.['fromMe']);
  const idRaw = key?.['id'] ?? info['ID'] ?? info['id'] ?? info['Id'];
  const waMessageId =
    typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : null;

  const chatRaw = key?.['remoteJid'] ?? info['Chat'] ?? info['chat'];
  const senderRaw =
    key?.['participant'] ??
    data['sender'] ??
    data['Sender'] ??
    info['Sender'] ??
    info['sender'];
  const chatJid = jidUserDigits(chatRaw);
  const senderJid = jidUserDigits(senderRaw);
  const chatStr = typeof chatRaw === 'string' ? chatRaw : '';
  const isGroup = chatStr.includes('@g.us');

  const msg = rootMessageNode(data);
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

export function parseMessageMedia(data: JsonRecord): WhatsappParsedMedia | null {
  const msg = rootMessageNode(data);
  const mappings: Array<{
    key: 'imageMessage' | 'videoMessage' | 'audioMessage' | 'documentMessage';
    mediaType: WhatsappParsedMedia['mediaType'];
  }> = [
    { key: 'imageMessage', mediaType: 'image' as const },
    { key: 'videoMessage', mediaType: 'video' as const },
    { key: 'audioMessage', mediaType: 'audio' as const },
    { key: 'documentMessage', mediaType: 'document' as const },
  ];
  for (const mapping of mappings) {
    const node = pickMediaNode(msg, mapping.key);
    if (!node) continue;
    const caption =
      readStringField(node, ['caption', 'Caption']);
    const sizeRaw = node['fileLength'] ?? node['filelength'] ?? node['size'];
    return {
      mediaType: mapping.mediaType,
      url: readStringField(node, [
        'URL',
        'url',
        'Url',
        'directPath',
        'DirectPath',
        'mediaUrl',
        'MediaUrl',
      ]),
      base64:
        readStringField(node, ['base64', 'Base64']) ||
        pickEnvelopeBase64(data, msg),
      mimeType: readStringField(node, [
        'mimetype',
        'mimeType',
        'MimeType',
        'Mimetype',
      ]),
      fileName: readStringField(node, [
        'fileName',
        'filename',
        'FileName',
        'Filename',
        'title',
        'Title',
      ]),
      size:
        typeof sizeRaw === 'number'
          ? sizeRaw
          : typeof sizeRaw === 'string' && /^\d+$/.test(sizeRaw)
            ? Number.parseInt(sizeRaw, 10)
            : null,
      caption,
    };
  }
  return null;
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
