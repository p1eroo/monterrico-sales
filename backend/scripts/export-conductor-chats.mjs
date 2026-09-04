#!/usr/bin/env node
/**
 * Export anonimizado de chats de conductores/afiliación (flota WhatsApp).
 *
 * Fuentes (ya clasificadas en "CrmWhatsappMessage"):
 *   - 'chatwoot'   : inbox Flota en Chatwoot
 *   - 'crm-flota'  : instancia compartida Evolution GO
 *
 * Se agrupa por conversación (teléfono del contacto, normalizado),
 * se enlaza al registro de prospecto/conductor local (FlotaProspecto)
 * para conservar distrito + vehículo (marca/modelo/año) y se elimina:
 * nombre, correo, DNI, placa y número. Los audios NO se transcriben
 * (no hay ASR); se marcan y se reporta su porcentaje por conversación
 * y global.
 *
 * Salida: JSONL (una conversación por línea), N conversaciones por lote.
 *
 * Uso:
 *   node --env-file=.env scripts/export-conductor-chats.mjs
 *   node --env-file=.env scripts/export-conductor-chats.mjs --days 90 --per-lote 100 --out exports/conductor-chats
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const { Client } = pg;

const args = parseArgs(process.argv.slice(2));
const DAYS = args.days; // undefined = sin límite (todo)
const PER_LOTE = args['per-lote'] ?? 100;
const OUT_DIR = path.resolve(args.out ?? path.join(process.cwd(), '..', 'exports', 'conductor-chats'));

const SOURCES = ['chatwoot', 'crm-flota'];

// ─── helpers ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = isNaN(Number(m[2])) ? m[2] : Number(m[2]);
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}

function log(...msg) { console.log('[export]', ...msg); }

function normPhone(raw) {
  if (raw == null) return '';
  return String(raw).replace(/^\+?51/, '').replace(/\D/g, '').slice(-9);
}

function lastDigits(raw) {
  const d = String(raw ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-9) : '';
}

const MSG_AUDIO = /\[audio\]/i;
const MSG_IMAGE = /\[image\]/i;
const MSG_VIDEO = /\[video\]/i;
const MSG_DOC = /\[document\]|\[archivo\]|\[documento\]/i;

function kindFromAtts(atts) {
  if (!Array.isArray(atts) || !atts.length) return null;
  const t = atts.map((a) => String(a?.file_type ?? '')).join(',');
  if (/\baudio\b/.test(t) || /audio\//.test(t)) return 'audio';
  if (/\bimage\b/.test(t) || /image\//.test(t)) return 'imagen';
  if (/\bvideo\b/.test(t) || /video\//.test(t)) return 'video';
  return 'documento';
}

/** Clasifica el tipo de mensaje según payload y body (sin mirar texto). */
function messageKind(row) {
  const body = String(row.body ?? '');
  const payload = row.payloadJson;
  const txt = payload ? JSON.stringify(payload) : '';

  if (MSG_AUDIO.test(body) || /audioMessage/.test(txt) || kindFromAtts(payload?.attachments) === 'audio') {
    return 'audio';
  }
  if (MSG_IMAGE.test(body) || /imageMessage/.test(txt) || kindFromAtts(payload?.attachments) === 'imagen') {
    return 'imagen';
  }
  if (MSG_VIDEO.test(body) || /videoMessage/.test(txt) || kindFromAtts(payload?.attachments) === 'video') {
    return 'video';
  }
  if (MSG_DOC.test(body) || /documentMessage/.test(txt) || /stickerMessage/.test(txt)) {
    return 'documento';
  }
  if (!body.trim()) return 'sin_texto';
  return 'texto';
}

// ─── sanitización de texto libre (PII dentro del transcript) ──────────
const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RE_CEL_PERU = /(?:\+?51[\s-]?)?9[0-9]{2}[\s-]?[0-9]{2}[\s-]?[0-9]{2}[\s-]?[0-9]{2}/g;
const RE_PLACA = /\b[A-Z]{3}[- ]?\d{3}\b/g; // AAA-123 / AAA123

function scrubText(text) {
  if (!text) return text;
  return String(text)
    .replace(RE_EMAIL, '[correo]')
    .replace(RE_CEL_PERU, '[telefono]')
    .replace(RE_PLACA, '[placa]');
}

// ─── scrub de campos prohibidos en metadata ────────────────────────────
function pickVehicle(p) {
  const v = {};
  if (p.marca) v.marca = p.marca;
  if (p.modelo) v.modelo = p.modelo;
  const anio = p.anioVehiculo ?? p.anio;
  if (anio != null && anio !== '') v.anio = Number(anio) || anio;
  return v;
}

function mergeVehicle(a, b) {
  for (const k of ['marca', 'modelo']) if (!a[k] && b[k]) a[k] = b[k];
  if (a.anio == null && b.anio != null) a.anio = b.anio;
  return a;
}

function buildMeta(prospecto, conductorReg, odatos) {
  const meta = {
    distrito: prospecto?.distrito ?? odatos?.distrito ?? null,
    vehiculo: null,
    estado: null,
    afiliado: false,
    es_conductor_registrado: !!conductorReg,
    tipo: 'sin_registro',
  };
  if (prospecto) {
    meta.estado = prospecto.estado ?? null;
    meta.afiliado = String(prospecto.estado ?? '').toUpperCase() === 'AFILIADO';
    meta.tipo = 'prospecto';
    meta.distrito = meta.distrito ?? null;
    const v = pickVehicle(prospecto);
    if (conductorReg) mergeVehicle(v, pickVehicle(conductorReg));
    if (Object.keys(v).length) meta.vehiculo = v;
  } else if (conductorReg) {
    meta.tipo = 'conductor';
    const v = pickVehicle(conductorReg);
    if (Object.keys(v).length) meta.vehiculo = v;
    meta.estado = 'conductor-registrado';
  }
  return meta;
}

// ─── main ──────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('Falta DATABASE_URL');
  const db = new Client({ connectionString: url });
  await db.connect();
  log('Conectado a la BD');

  const whereSource = SOURCES.map((_, i) => `"evoInstanceName" = $${i + 1}`).join(' OR ');
  const whereExtra = `("flotaProspectoId" IS NOT NULL OR "contactId" IS NULL)`;
  const whereTime = DAYS ? `AND "createdAt" >= now() - interval '${Number(DAYS)} days'` : '';

  const msgs = await db.query(
    `SELECT m.id,
            m."direction",
            m."fromWaId",
            m."toWaId",
            m.body,
            m."payloadJson",
            m."createdAt",
            m."evoInstanceName" AS source,
            m."flotaProspectoId",
            p."nombreCompleto" AS p_nombre,
            p.estado          AS p_estado,
            p.distrito        AS p_distrito,
            p.marca           AS p_marca,
            p.modelo          AS p_modelo,
            p."anioVehiculo"  AS p_anio,
            p."eliminadoAt"   AS p_eliminado
     FROM "CrmWhatsappMessage" m
     LEFT JOIN "FlotaProspecto" p ON p.id = m."flotaProspectoId"
     WHERE (${whereSource}) AND (${whereExtra}) ${whereTime}
     ORDER BY m."createdAt" ASC`,
    SOURCES,
  );
  log(`Mensajes leídos: ${msgs.rowCount}`);

  // índice de prospectos por teléfono (para chats sin vínculo directo)
  const pros = await db.query(
    `SELECT id, celular, estado, distrito, marca, modelo, "anioVehiculo", "eliminadoAt"
     FROM "FlotaProspecto"`,
  );
  const prospectByPhone = new Map();
  const prospectById = new Map();
  for (const p of pros.rows) {
    const d = normPhone(p.celular);
    prospectById.set(p.id, p);
    if (!d) continue;
    const prev = prospectByPhone.get(d);
    if (!prev) prospectByPhone.set(d, p);
    else if (p.eliminadoAt == null && prev.eliminadoAt != null) prospectByPhone.set(d, p);
    else if (!prev.eliminadoAt && !p.eliminadoAt && p.id.length > prev.id.length) prospectByPhone.set(d, p);
  }
  log(`Prospectos indexados: ${pros.rowCount}`);

  // registro de conductores (WAsociados) para chats sin prospecto
  const conductores = await fetchConductoresRegistry();
  const conductorByPhone = new Map();
  for (const c of conductores ?? []) {
    for (const t of [c.telefonop, c.telefonos]) {
      if (!t) continue;
      for (const part of String(t).split('/')) {
        const d = normPhone(part);
        if (d.length >= 8) conductorByPhone.set(d, c);
      }
    }
  }
  log(`Conductores registrados indexados: ${conductorByPhone.size} teléfonos`);

  // agrupar por conversación (teléfono normalizado)
  const convs = new Map(); // phoneDigits -> {phone, msgs: []}
  const LID = /(\d{10,})/; // lids: números >9 dígitos sin nacional = se descartan
  for (const row of msgs.rows) {
    const peerRaw = row.direction === 'inbound' ? row.fromWaId : row.toWaId;
    const digits = normPhone(peerRaw);
    if (!digits || digits.length < 8) continue;
    if (/\d{10,}/.test(digits) && !/^9\d{8}$/.test(digits) && !/^[12]\d{8}$/.test(digits)) continue;
    let c = convs.get(digits);
    if (!c) { c = { digits, msgs: [] }; convs.set(digits, c); }
    row._peerDigits = digits;
    row._kind = messageKind(row);
    c.msgs.push(row);
  }
  log(`Conversaciones detectadas: ${convs.size}`);

  // resolver metadata por conversación (prospecto preferido > conductor reg)
  const odatosCache = new Map(); // idasociado -> { distrito } | null
  const odatosPending = new Map(); // idasociado -> Promise
  const fetchOdatos = (idasociado) => {
    if (odatosCache.has(idasociado)) return Promise.resolve(odatosCache.get(idasociado));
    if (!odatosPending.has(idasociado)) {
      odatosPending.set(idasociado, (async () => {
        try {
          const res = await fetch(
            `https://api.taximonterrico.com/api/wasociados/Datos?idasociado=${idasociado}`,
            { signal: AbortSignal.timeout(15000) },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const d = await res.json();
          const o = d?.ODatos;
          const r = { distrito: o?.distrito || null };
          odatosCache.set(idasociado, r);
          return r;
        } catch {
          odatosCache.set(idasociado, null);
          return null;
        }
      })());
    }
    return odatosPending.get(idasociado);
  };

  const enriched = [];
  let oDatosLlamadas = 0, oDatosConDistrito = 0;
  for (const [digits, c] of convs) {
    const byLink = c.msgs.map((m) => m.flotaProspectoId).find((id) => id && prospectById.has(id));
    let prospecto = byLink ? prospectById.get(byLink) : null;
    if (!prospecto) prospecto = prospectByPhone.get(digits) ?? null;

    const conductorReg = conductorByPhone.get(digits) ?? null;

    let odatos = null;
    if (conductorReg?.idasociado && !prospecto?.distrito) {
      oDatosLlamadas++;
      odatos = await fetchOdatos(conductorReg.idasociado);
      if (odatos?.distrito) oDatosConDistrito++;
    }

    const sorted = c.msgs.slice().sort((a, b) => a.createdAt - b.createdAt);
    const deduped = [];
    for (const m of sorted) {
      const prev = deduped[deduped.length - 1];
      const isEcho =
        prev &&
        String(prev.body ?? '').trim() === String(m.body ?? '').trim() &&
        Math.abs(m.createdAt - prev.createdAt) <= 5_000;
      if (!isEcho) deduped.push(m);
    }

    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    const meta = buildMeta(prospecto, conductorReg, odatos);

    const rows = deduped.map((m, i) => {
      const role = m.direction === 'inbound' ? 'conductor' : 'agente';
      const kind = m._kind;
      const texto = kind === 'audio'
        ? '[audio]'
        : kind === 'texto'
          ? scrubText(m.body)
          : `[${kind}]`;
      return {
        n: i + 1,
        role,
        type: kind,
        texto: kind === 'audio' ? '[audio]' : texto,
        ts: m.createdAt.toISOString(),
      };
    });

    const audioCount = rows.filter((r) => r.type === 'audio').length;
    const sources = [...new Set(c.msgs.map((m) => m.source).filter(Boolean))];
    enriched.push({
      digits,
      sources,
      source: sources[0] ?? 'desconocida',
      prospecto,
      rows,
      audioCount,
      echoRemoved: c.msgs.length - deduped.length,
      first: first.createdAt,
      last: last.createdAt,
      meta,
    });
  }

  // ordenar por último mensaje desc (más recientes primero)
  enriched.sort((a, b) => b.last - a.last);

  // stats globales
  const totalEchoRemoved = enriched.reduce((n, c) => n + c.echoRemoved, 0);
  const totalMsgs = enriched.reduce((n, c) => n + c.rows.length, 0);
  const totalAudio = enriched.reduce((n, c) => n + c.audioCount, 0);
  const audioPctGlobal = totalMsgs ? (totalAudio / totalMsgs) * 100 : 0;
  const chatsConAudio = enriched.filter((c) => c.audioCount > 0).length;
  const chatAudioOver15 = enriched.filter((c) => c.rows.length > 0 && (c.audioCount / c.rows.length) * 100 > 15).length;

  const coverDistrito = enriched.filter((c) => c.meta.distrito).length;
  const coverVehCompleto = enriched.filter((c) => c.meta.vehiculo && c.meta.vehiculo.marca && c.meta.vehiculo.modelo && c.meta.vehiculo.anio).length;
  const coverVehParcial = enriched.filter((c) => c.meta.vehiculo).length;
  const convProspecto = enriched.filter((c) => c.meta.tipo === 'prospecto').length;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // escribir lotes JSONL
  const lotes = Math.max(1, Math.ceil(enriched.length / PER_LOTE));
  const files = [];
  for (let l = 0; l < lotes; l++) {
    const chunk = enriched.slice(l * PER_LOTE, (l + 1) * PER_LOTE);
    const fname = `lote-${String(l + 1).padStart(3, '0')}.jsonl`;
    const stream = fs.createWriteStream(path.join(OUT_DIR, fname), 'utf8');
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      const convId = `conv-${String(l * PER_LOTE + i + 1).padStart(6, '0')}`;
      const nMsgs = c.rows.length;
      const line = {
        conversation_id: convId,
        lote: l + 1,
        fuentes: c.sources,
        fuente: c.source,
        tipo: c.meta.tipo,
        estado: c.meta.estado,
        afiliado: c.meta.afiliado,
        es_conductor_registrado: c.meta.es_conductor_registrado,
        distrito: c.meta.distrito ?? null,
        vehiculo: c.meta.vehiculo,
        fecha_primer_mensaje: c.first.toISOString(),
        fecha_ultimo_mensaje: c.last.toISOString(),
        n_mensajes: nMsgs,
        n_mensajes_conductor: c.rows.filter((r) => r.role === 'conductor').length,
        n_mensajes_agente: c.rows.filter((r) => r.role === 'agente').length,
        ecos_removidos: c.echoRemoved,
        audio: {
          cantidad: c.audioCount,
          porcentaje: nMsgs ? Number(((c.audioCount / nMsgs) * 100).toFixed(2)) : 0,
          mensajes: c.rows.filter((r) => r.type === 'audio').map((r) => r.n),
        },
        mensajes: c.rows,
      };
      stream.write(JSON.stringify(line) + '\n');
    }
    await new Promise((res, rej) => stream.end((e) => (e ? rej(e) : res())));
    files.push(fname);
  }

  // manifest
  const manifest = {
    generado: new Date().toISOString(),
    alcance: {
      fuentes: SOURCES,
      ventana_dias: DAYS ?? 'todo',
      mensajes_leidos: msgs.rowCount,
      ecos_automaticos_removidos: totalEchoRemoved,
      conversaciones: enriched.length,
      conversaciones_con_prospecto: convProspecto,
      conversaciones_conductor_registrado: enriched.filter((c) => c.meta.tipo === 'conductor').length,
      conversaciones_con_es_conductor: enriched.filter((c) => c.meta.es_conductor_registrado).length,
      conversaciones_sin_registro: enriched.filter((c) => c.meta.tipo === 'sin_registro').length,
      llamadas_odatos: oDatosLlamadas,
      odatos_con_distrito: oDatosConDistrito,
      cobertura_distrito: coverDistrito,
      cobertura_vehiculo_completo: coverVehCompleto,
      cobertura_vehiculo_parcial: coverVehParcial,
    },
    audio: {
      mensajes_audio: totalAudio,
      mensajes_total: totalMsgs,
      porcentaje_global: Number(audioPctGlobal.toFixed(2)),
      chats_con_audio: chatsConAudio,
      chats_con_audio_sobre_15pct: chatAudioOver15,
      requiere_voz_desde_dia_uno: audioPctGlobal > 15,
      nota: 'No hay motor ASR en el stack; los audios se marcan [audio] sin transcribir. El umbral de 15% se evalúa sobre el porcentaje global de mensajes de audio.',
    },
    cobertura_metadata: {
      distrito: `${coverDistrito} de ${enriched.length} conversaciones`,
      vehiculo_marca_modelo_anio: `${coverVehCompleto} de ${enriched.length} conversaciones`,
      vehiculo_parcial: `${coverVehParcial} de ${enriched.length} conversaciones`,
    },
    anonimizacion: {
      eliminado: ['nombre', 'correo', 'DNI', 'placa', 'teléfono', 'agente'],
      conservado: ['distrito', 'marca', 'modelo', 'año del vehículo', 'estado', 'fechas'],
      scrub_texto: ['[telefono]', '[correo]', '[placa]'],
    },
    formato: 'jsonl / una conversación por línea',
    archivos: files.map((f) => path.join(path.basename(OUT_DIR), f)),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // resumen top chats con audio
  const topAudio = enriched
    .filter((c) => c.audioCount > 0)
    .sort((a, b) => b.audioCount / b.rows.length - a.audioCount / a.rows.length)
    .slice(0, 10)
    .map((c) => ({ digito_final: '****' + c.digits.slice(-3), n_mensajes: c.rows.length, audios: c.audioCount, pct: Number(((c.audioCount / c.rows.length) * 100).toFixed(1)) }));

  log('─────────────────────────────');
  log(`Conversaciones exportadas: ${enriched.length}`);
  log(`Mensajes totales: ${totalMsgs}`);
  log(`Mensajes de audio: ${totalAudio} (${audioPctGlobal.toFixed(2)}%)`);
  log(`Chats con al menos 1 audio: ${chatsConAudio}`);
  log(`Chats con >15% de audio: ${chatAudioOver15}`);
  log(`Archivos escritos en ${OUT_DIR}:`);
  for (const f of files) log('  -', f);
  if (totalAudio > 0) { log('Top chats con más % audio:'); for (const t of topAudio) log('  ', t); }
  if (audioPctGlobal > 15) {
    log('⚠️  El % de audio supera 15%: el flujo necesita manejo de voz desde el día uno.');
  }
  await db.end();
}

async function fetchConductoresRegistry() {
  try {
    const res = await fetch('https://api.taximonterrico.com/api/WAsociados/registrados?idestado=0', { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const arr = data?.ARegistrados ?? (Array.isArray(data) ? data : data?.data ?? []);
    return arr;
  } catch (e) {
    log(`No se pudo leer el registro de conductores WAsociados: ${e instanceof Error ? e.message : e}. Se omitirá enriquecimiento.`);
    return [];
  }
}

main().catch((e) => {
  console.error('[export] Error:', e);
  process.exit(1);
});
