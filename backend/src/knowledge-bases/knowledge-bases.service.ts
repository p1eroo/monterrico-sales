import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AiKnowledgeBase } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import {
  DEFAULT_CHUNK_SIZE_TOKENS,
  DEFAULT_OVERLAP_TOKENS,
} from './knowledge-ingest.constants';
import { extractIndexableTextFromUpload } from './knowledge-upload.helpers';

const TOKEN_CHAR_RATIO = 3.5;
const MAX_URL_INGEST_CHARS = 2_000_000;
const FETCH_TIMEOUT_MS = 25_000;

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  const x = typeof n === 'number' ? n : Number.parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(x)));
}

/** Partición por caracteres alineada con la estimación ~chars/3.5 del frontend. */
export function splitIntoChunks(
  text: string,
  chunkSizeTokens: number,
  overlapTokens: number,
): string[] {
  const chunkChars = Math.max(
    200,
    Math.round(clampInt(chunkSizeTokens, 400, 64, 8192) * TOKEN_CHAR_RATIO),
  );
  let overlapChars = Math.round(
    clampInt(overlapTokens, 64, 0, 4096) * TOKEN_CHAR_RATIO,
  );
  overlapChars = Math.min(overlapChars, Math.floor(chunkChars / 2));

  const t = text.trim();
  if (!t.length) return [];

  const result: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + chunkChars, t.length);
    const slice = t.slice(start, end).trim();
    if (slice.length) result.push(slice);
    if (end >= t.length) break;
    const nextStart = end - overlapChars;
    start = nextStart <= start ? end : nextStart;
  }
  return result;
}

export type KnowledgeBaseListItem = {
  id: string;
  title: string;
  description: string;
  type: string;
  chunks: number;
  agentName: string;
  updatedAt: string;
  status: string;
};

@Injectable()
export class KnowledgeBasesService {
  constructor(private readonly prisma: PrismaService) {}

  private toListItem(row: AiKnowledgeBase): KnowledgeBaseListItem {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      chunks: row.chunkCount,
      agentName: row.linkedAgentName?.trim() || 'Sin vincular',
      updatedAt: row.updatedAt.toISOString(),
      status: row.status,
    };
  }

  async listForUser(userId: string): Promise<KnowledgeBaseListItem[]> {
    const rows = await this.prisma.aiKnowledgeBase.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async createForUser(
    userId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseListItem> {
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('El título es obligatorio');

    const sourceMode = dto.sourceMode?.trim();
    if (
      !sourceMode ||
      !['text_only', 'upload', 'url', 'existing'].includes(sourceMode)
    ) {
      throw new BadRequestException('Origen del contenido no válido');
    }

    if (sourceMode === 'upload') {
      throw new BadRequestException(
        'La subida de archivos aún no está disponible en el servidor.',
      );
    }

    const description = (dto.description ?? '').trim();
    if (!description) {
      throw new BadRequestException('La descripción o el contenido es obligatorio');
    }

    const type = (dto.type ?? 'documentos').trim() || 'documentos';
    const chunkSize = clampInt(
      dto.chunkSize,
      DEFAULT_CHUNK_SIZE_TOKENS,
      64,
      8192,
    );
    const overlap = clampInt(
      dto.overlap,
      DEFAULT_OVERLAP_TOKENS,
      0,
      4096,
    );

    const linkedAgentId = dto.linkedAgentId?.trim() || null;
    const linkedAgentName = dto.linkedAgentName?.trim() || null;

    const sourceJson = sanitizeSourceJson(dto.source, sourceMode);

    const userDescription = description.slice(0, 500_000);

    let descriptionToStore = userDescription;
    let status = 'pendiente';
    let indexError: string | null = null;
    let indexedAt: Date | null = null;
    let chunksPayload: { position: number; content: string }[] = [];

    if (sourceMode === 'text_only') {
      chunksPayload = splitIntoChunks(description, chunkSize, overlap).map(
        (content, position) => ({ position, content }),
      );
      if (chunksPayload.length === 0) {
        throw new BadRequestException('No hay texto indexable');
      }
      descriptionToStore = userDescription;
      status = 'indexado';
      indexedAt = new Date();
    } else if (sourceMode === 'url') {
      const url = typeof sourceJson?.url === 'string' ? sourceJson.url.trim() : '';
      const method =
        typeof sourceJson?.method === 'string'
          ? sourceJson.method.toUpperCase()
          : 'GET';
      const authType =
        typeof sourceJson?.authType === 'string' ? sourceJson.authType : 'none';

      if (!url) {
        throw new BadRequestException('Falta la URL del endpoint');
      }

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new BadRequestException('La URL no es válida');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException('Solo se permiten URLs http(s)');
      }

      descriptionToStore = userDescription;

      if (method === 'GET' && authType === 'none') {
        try {
          const body = await fetchPublicUrlText(url);
          if (body.length > MAX_URL_INGEST_CHARS) {
            throw new BadRequestException(
              'El recurso descargado supera el tamaño máximo permitido',
            );
          }
          chunksPayload = splitIntoChunks(body, chunkSize, overlap).map(
            (content, position) => ({ position, content }),
          );
          if (chunksPayload.length === 0) {
            status = 'error';
            indexError = 'La respuesta no produjo fragmentos indexables';
          } else {
            status = 'indexado';
            indexedAt = new Date();
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
          status = 'error';
          indexError =
            e instanceof Error ? e.message : 'No se pudo obtener la URL';
        }
      } else {
        status = 'sync';
        indexError = null;
        chunksPayload = [];
      }
    } else if (sourceMode === 'existing') {
      descriptionToStore = userDescription;
      status = 'sync';
      chunksPayload = [];
    }

    const chunkCount = chunksPayload.length;

    const row = await this.prisma.$transaction(async (tx) => {
      const base = await tx.aiKnowledgeBase.create({
        data: {
          userId,
          title,
          type,
          sourceMode,
          description: descriptionToStore,
          chunkSize,
          overlap,
          linkedAgentId,
          linkedAgentName,
          status,
          chunkCount,
          sourceJson: sourceJson as object | undefined,
          indexError,
          indexedAt,
        },
      });

      if (chunksPayload.length > 0) {
        await tx.aiKnowledgeChunk.createMany({
          data: chunksPayload.map((c) => ({
            knowledgeBaseId: base.id,
            position: c.position,
            content: c.content,
          })),
        });
      }

      return base;
    });

    return this.toListItem(row);
  }

  async createFromUpload(
    userId: string,
    files: Array<{
      buffer: Buffer;
      mimetype?: string;
      originalname?: string;
    }>,
    meta: {
      title: string;
      chunkSize?: string;
      overlap?: string;
      linkedAgentId?: string;
      linkedAgentName?: string;
    },
  ): Promise<KnowledgeBaseListItem> {
    const title = meta.title?.trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    if (!files?.length) {
      throw new BadRequestException('Adjunta al menos un archivo');
    }

    const chunkSize = clampInt(
      meta.chunkSize,
      DEFAULT_CHUNK_SIZE_TOKENS,
      64,
      8192,
    );
    const overlap = clampInt(
      meta.overlap,
      DEFAULT_OVERLAP_TOKENS,
      0,
      4096,
    );

    const linkedAgentId = meta.linkedAgentId?.trim() || null;
    const linkedAgentName = meta.linkedAgentName?.trim() || null;

    const skipped: string[] = [];
    const includedNames: string[] = [];
    const parts: string[] = [];

    for (const f of files) {
      const text = await extractIndexableTextFromUpload(f);
      const label = f.originalname || 'archivo';
      if (text == null) {
        skipped.push(label);
        continue;
      }
      const t = text.trim();
      if (!t.length) {
        skipped.push(`${label} (vacío)`);
        continue;
      }
      includedNames.push(label);
      parts.push(`--- Archivo: ${label} ---\n${text}`);
    }

    if (parts.length === 0) {
      const hint =
        skipped.length > 0
          ? `Ningún archivo tenía texto indexable (${skipped.slice(0, 12).join(', ')}${skipped.length > 12 ? '…' : ''}). Tipos admitidos: .txt, .md, .json, .csv, .html, .pdf (PDF solo con texto seleccionable; escaneados sin OCR no).`
          : 'No se pudo leer texto de los archivos';
      throw new BadRequestException(hint);
    }

    const combined = parts.join('\n\n');
    const userDescription = combined.slice(0, 500_000);

    const chunksPayload = splitIntoChunks(combined, chunkSize, overlap).map(
      (content, position) => ({ position, content }),
    );

    if (chunksPayload.length === 0) {
      throw new BadRequestException(
        'No hay contenido indexable tras procesar los archivos',
      );
    }

    const sourceJson = {
      upload: true,
      filesTotal: files.length,
      filesIndexed: includedNames.length,
      fileNames: includedNames,
      skippedFiles: skipped.length ? skipped : undefined,
    };

    const row = await this.prisma.$transaction(async (tx) => {
      const base = await tx.aiKnowledgeBase.create({
        data: {
          userId,
          title,
          type: 'documentos',
          sourceMode: 'upload',
          description: userDescription,
          chunkSize,
          overlap,
          linkedAgentId,
          linkedAgentName,
          status: 'indexado',
          chunkCount: chunksPayload.length,
          sourceJson: sourceJson as object,
          indexError: null,
          indexedAt: new Date(),
        },
      });

      await tx.aiKnowledgeChunk.createMany({
        data: chunksPayload.map((c) => ({
          knowledgeBaseId: base.id,
          position: c.position,
          content: c.content,
        })),
      });

      return base;
    });

    return this.toListItem(row);
  }

  async deleteForUser(userId: string, id: string): Promise<void> {
    const res = await this.prisma.aiKnowledgeBase.deleteMany({
      where: { id, userId },
    });
    if (res.count === 0) {
      throw new NotFoundException('Base de conocimiento no encontrada');
    }
  }
}

async function fetchPublicUrlText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/json,text/plain,*/*',
        'User-Agent': 'MonterricoSales-KB-Ingest/1.0',
      },
    });
    if (!res.ok) {
      throw new Error(`La URL respondió HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeSourceJson(
  raw: Record<string, unknown> | undefined,
  sourceMode: string,
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const out: Record<string, unknown> = {};

  if (typeof raw.url === 'string') out.url = raw.url.trim();
  if (typeof raw.method === 'string') out.method = String(raw.method).toUpperCase();
  if (typeof raw.authType === 'string') out.authType = raw.authType;
  if (typeof raw.apiKeyHeader === 'string') {
    out.apiKeyHeader = raw.apiKeyHeader.trim().slice(0, 128);
  }
  if (typeof raw.postBody === 'string') {
    out.postBody = raw.postBody.slice(0, 50_000);
  }
  if (typeof raw.notes === 'string') out.notes = raw.notes.slice(0, 20_000);

  if (sourceMode === 'existing') {
    if (typeof raw.scope === 'string') out.scope = raw.scope;
    if (typeof raw.entityId === 'string') out.entityId = raw.entityId.trim();
    if (typeof raw.hint === 'string') out.hint = raw.hint.slice(0, 20_000);
  }

  // Nunca persistir campos de secreto si el cliente los envía por error
  delete out.bearerToken;
  delete out.apiKey;
  delete out.secret;
  delete out.password;

  return Object.keys(out).length ? out : undefined;
}
