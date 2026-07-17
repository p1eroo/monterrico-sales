import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type DocumentTipo = 'dni' | 'licencia' | 'soat' | 'tive' | 'otro';

export type DocumentVisionResult = {
  tipoDocumento: DocumentTipo;
  confianza: number;
  nombresApellidos: string | null;
  dni: string | null;
  fechaNacimiento: string | null;
  numeroLicencia: string | null;
  placa: string | null;
  anioModelo: number | null;
  categoriaVehiculo: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  combustible: string | null;
};

const VISION_PROMPT = `Eres un extractor de datos de documentos peruanos para afiliación de conductores.
Analiza la imagen y responde SOLO con JSON válido (sin markdown).

Clasifica el documento:
- "dni": Documento Nacional de Identidad (RENIEC), con foto de persona
- "licencia": Licencia de conducir / brevete del conductor (no confundir con categoría M1 del vehículo)
- "soat": Certificado SOAT (seguro vehicular obligatorio)
- "tive": Tarjeta de Identificación Vehicular Electrónica (SUNARP) — sección "Datos del Vehículo"
- "otro": cualquier otra imagen (selfie, pantalla, comprobante, ilegible)

Extrae solo los campos que correspondan al tipo detectado; usa null para el resto.
NO extraigas dirección ni correo electrónico.

Formato exacto:
{
  "tipoDocumento": "dni|licencia|soat|tive|otro",
  "confianza": 0.0,
  "nombresApellidos": null,
  "dni": null,
  "fechaNacimiento": null,
  "numeroLicencia": null,
  "placa": null,
  "anioModelo": null,
  "categoriaVehiculo": null,
  "marca": null,
  "modelo": null,
  "color": null,
  "combustible": null
}

Reglas:
- dni: 8 dígitos sin puntos; nombresApellidos en mayúsculas como en el documento
- fechaNacimiento: YYYY-MM-DD si aparece en el DNI
- placa: formato peruano (ej. ABC-123 o CZM682)
- anioModelo: número entero del "Año Modelo" en TIVE/SUNARP
- numeroLicencia: solo para brevete/licencia de conducir del conductor
- tive (Tarjeta SUNARP): extrae categoriaVehiculo (ej. M1), marca, modelo, color, combustible, placa, anioModelo
- confianza: 0-1 según claridad de la imagen y certeza de los datos`;

@Injectable()
export class DocumentVisionService {
  private readonly logger = new Logger(DocumentVisionService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('OPENAI_API_KEY')?.trim();
  }

  async extractFromDocument(
    buffer: Buffer,
    mimeType: string,
  ): Promise<DocumentVisionResult | null> {
    const m = (mimeType || '').toLowerCase().split(';')[0].trim();
    if (m === 'application/pdf') {
      return this.extractFromPdf(buffer);
    }
    return this.extractFromImage(buffer, mimeType);
  }

  async extractFromImage(
    buffer: Buffer,
    mimeType: string,
  ): Promise<DocumentVisionResult | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY no configurada; se omite extracción de documento');
      return null;
    }

    const normalizedMime = this.normalizeImageMime(mimeType);
    if (!normalizedMime) {
      this.logger.debug(`MIME no soportado para visión: ${mimeType}`);
      return null;
    }

    const model =
      this.config.get<string>('OPENAI_VISION_MODEL')?.trim() || 'gpt-4o-mini';
    const b64 = buffer.toString('base64');
    const dataUrl = `data:${normalizedMime};base64,${b64}`;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_PROMPT },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(
          `OpenAI Vision HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
        return null;
      }

      let parsed: { choices?: Array<{ message?: { content?: string } }> };
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        this.logger.warn('Respuesta OpenAI Vision no es JSON');
        return null;
      }

      const content = parsed.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      return this.parseVisionJson(content);
    } catch (e) {
      this.logger.warn(
        `OpenAI Vision falló: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<DocumentVisionResult | null> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const { text } = await pdfParse(buffer);
      const normalized = (text || '').replace(/\s+/g, ' ').trim();

      if (normalized.length > 60) {
        const local = this.parseFromPdfText(normalized);
        if (local) return local;
      }
    } catch (e) {
      this.logger.warn(
        `pdf-parse falló: ${e instanceof Error ? e.message : e}`,
      );
    }

    return this.extractFromPdfViaVision(buffer);
  }

  private parseFromPdfText(text: string): DocumentVisionResult | null {
    const upper = text.toUpperCase();

    if (
      upper.includes('SOAT') ||
      upper.includes('VIGENCIA DE LA PÓLIZA') ||
      upper.includes('VIGENCIA DE LA POLIZA') ||
      upper.includes('COMPAÑÍA DE SEGUROS') ||
      upper.includes('COMPANIA DE SEGUROS')
    ) {
      const placa = this.extractPlacaFromText(text);
      if (!placa) return null;
      return {
        tipoDocumento: 'soat',
        confianza: 0.85,
        nombresApellidos: null,
        dni: null,
        fechaNacimiento: null,
        numeroLicencia: null,
        placa,
        anioModelo: null,
        categoriaVehiculo: null,
        marca: null,
        modelo: null,
        color: null,
        combustible: null,
      };
    }

    if (
      upper.includes('SUNARP') ||
      upper.includes('TARJETA DE IDENTIFICACIÓN VEHICULAR') ||
      upper.includes('TARJETA DE IDENTIFICACION VEHICULAR') ||
      upper.includes('DATOS DEL VEHÍCULO') ||
      upper.includes('DATOS DEL VEHICULO')
    ) {
      return this.parseTiveFromText(text);
    }

    return null;
  }

  private parseTiveFromText(text: string): DocumentVisionResult | null {
    const pick = (patterns: RegExp[]) => {
      for (const re of patterns) {
        const m = text.match(re);
        if (m?.[1]?.trim()) return m[1].trim();
      }
      return null;
    };

    const categoriaVehiculo = pick([
      /categor[ií]a\s*:?\s*([A-Z0-9]{1,4})/i,
    ]);
    const marca = pick([/marca\s*:?\s*([A-Z0-9][A-Z0-9\s.-]{1,40})/i]);
    const modelo = pick([/modelo\s*:?\s*([A-Z0-9][A-Z0-9\s.+/-]{1,40})/i]);
    const color = pick([/color\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{1,30})/i]);
    const combustible = pick([
      /combustible\s*:?\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s.-]{1,40})/i,
    ]);
    const placaRaw = pick([
      /placa\s*n[ºo°]?\s*:?\s*([A-Z0-9-]{6,10})/i,
    ]);
    const anioStr = pick([/año\s*modelo\s*:?\s*(\d{4})/i, /ano\s*modelo\s*:?\s*(\d{4})/i]);
    const placa = placaRaw ? this.normalizePlaca(placaRaw) : null;
    const anioModelo = anioStr ? this.parseAnio(anioStr) : null;

    if (!placa && !categoriaVehiculo && !marca) return null;

    return {
      tipoDocumento: 'tive',
      confianza: 0.82,
      nombresApellidos: null,
      dni: null,
      fechaNacimiento: null,
      numeroLicencia: null,
      placa,
      anioModelo,
      categoriaVehiculo: categoriaVehiculo?.toUpperCase() ?? null,
      marca: marca?.toUpperCase() ?? null,
      modelo: modelo?.toUpperCase() ?? null,
      color: color?.toUpperCase() ?? null,
      combustible: combustible?.toUpperCase() ?? null,
    };
  }

  private extractPlacaFromText(text: string): string | null {
    const m =
      text.match(/placa\s*:?\s*([A-Z0-9-]{6,10})/i) ||
      text.match(/\b([A-Z]{3}-?\d{3})\b/);
    return m?.[1] ? this.normalizePlaca(m[1]) : null;
  }

  private async extractFromPdfViaVision(
    buffer: Buffer,
  ): Promise<DocumentVisionResult | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) return null;

    const model =
      this.config.get<string>('OPENAI_VISION_MODEL')?.trim() || 'gpt-4o-mini';
    const b64 = buffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${b64}`;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_PROMPT },
                {
                  type: 'file',
                  file: {
                    filename: 'documento.pdf',
                    file_data: dataUrl,
                  },
                },
              ],
            },
          ],
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        this.logger.warn(
          `OpenAI Vision PDF HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
        return null;
      }

      const parsed = JSON.parse(text) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = parsed.choices?.[0]?.message?.content?.trim();
      if (!content) return null;
      return this.parseVisionJson(content);
    } catch (e) {
      this.logger.warn(
        `OpenAI Vision PDF falló: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }

  private normalizeImageMime(mime: string): string | null {
    const m = (mime || '').toLowerCase().split(';')[0].trim();
    if (m === 'image/jpg') return 'image/jpeg';
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(m)) {
      return m;
    }
    return null;
  }

  private parseVisionJson(raw: string): DocumentVisionResult | null {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const tipo = this.parseTipo(j.tipoDocumento);
      const confianza = this.clamp01(j.confianza);
      return {
        tipoDocumento: tipo,
        confianza,
        nombresApellidos: this.str(j.nombresApellidos),
        dni: this.normalizeDni(j.dni),
        fechaNacimiento: this.parseDateIso(j.fechaNacimiento),
        numeroLicencia: this.str(j.numeroLicencia),
        placa: this.normalizePlaca(j.placa),
        anioModelo: this.parseAnio(j.anioModelo),
        categoriaVehiculo: this.str(j.categoriaVehiculo)?.toUpperCase() ?? null,
        marca: this.str(j.marca)?.toUpperCase() ?? null,
        modelo: this.str(j.modelo)?.toUpperCase() ?? null,
        color: this.str(j.color)?.toUpperCase() ?? null,
        combustible: this.str(j.combustible)?.toUpperCase() ?? null,
      };
    } catch {
      this.logger.warn('JSON de visión inválido');
      return null;
    }
  }

  private parseTipo(v: unknown): DocumentTipo {
    const s = String(v || '').toLowerCase();
    if (s === 'dni' || s === 'licencia' || s === 'soat' || s === 'tive') {
      return s;
    }
    return 'otro';
  }

  private str(v: unknown): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  }

  private normalizeDni(v: unknown): string | null {
    const digits = String(v ?? '').replace(/\D/g, '');
    return digits.length === 8 ? digits : null;
  }

  private normalizePlaca(v: unknown): string | null {
    if (v == null) return null;
    const raw = String(v)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (raw.length < 6) return null;
    if (raw.length === 6) {
      return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    return raw;
  }

  private parseDateIso(v: unknown): string | null {
    const s = String(v ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : s;
  }

  private parseAnio(v: unknown): number | null {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    if (!Number.isFinite(n) || n < 1980 || n > 2100) return null;
    return n;
  }

  private clamp01(v: unknown): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }
}
