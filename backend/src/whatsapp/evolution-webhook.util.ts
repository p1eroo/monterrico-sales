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
          : typeof nestedInstance?.['instanceName'] === 'string'
            ? nestedInstance['instanceName']
            : typeof nestedInstance?.['name'] === 'string'
              ? nestedInstance['name']
              : typeof nestedInstanceUpper?.['instanceName'] === 'string'
                ? nestedInstanceUpper['instanceName']
                : typeof nestedInstanceUpper?.['name'] === 'string'
                  ? nestedInstanceUpper['name']
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
    instanceId: base.instanceId,
    instanceName: base.instanceName,
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
