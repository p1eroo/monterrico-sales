import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';

export type PreparedAudio = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

@Injectable()
export class AudioConversionService {
  private readonly logger = new Logger(AudioConversionService.name);

  private normalizeMime(mime: string): string {
    return (mime || '').toLowerCase().split(';')[0].trim();
  }

  private replaceExt(name: string, ext: string): string {
    const base = (name || 'audio').replace(/\.[^.]+$/, '');
    return `${base || 'audio'}.${ext}`;
  }

  shouldConvert(mimeType: string): boolean {
    const mime = this.normalizeMime(mimeType);
    return (
      mime === 'audio/webm'
      || mime === 'audio/ogg'
      || mime === 'application/ogg'
      || mime === 'audio/opus'
      ||       mime === 'audio/wav'
      || mime === 'audio/x-wav'
    );
  }

  looksLikeAudio(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) return false;
    if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return true;
    }
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
    if (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return true;
    if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true;
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return true;
    }
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  }

  /**
   * Convierte notas de voz (OGG/Opus de WhatsApp) a MP3 para el navegador.
   * Si ffmpeg falla, devuelve el buffer original.
   */
  async prepareForBrowserPlayback(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const normalized = this.normalizeMime(mimeType);
    if (!buffer?.length || !this.shouldConvert(normalized) || !this.looksLikeAudio(buffer)) {
      return { buffer, mimeType: normalized || mimeType || 'application/octet-stream' };
    }
    try {
      const mp3 = await this.convertToMp3(buffer);
      this.logger.log(
        `Audio para navegador ${normalized} → audio/mpeg (${buffer.length} → ${mp3.length} bytes)`,
      );
      return { buffer: mp3, mimeType: 'audio/mpeg' };
    } catch (e) {
      this.logger.warn(
        `No se pudo convertir audio para el navegador (${normalized}): ${e instanceof Error ? e.message : e}`,
      );
      return { buffer, mimeType: normalized || mimeType };
    }
  }

  /** Convierte grabaciones del navegador a MP3 para WhatsApp / Chatwoot. */
  async prepareForMessaging(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<PreparedAudio> {
    if (!buffer?.length) {
      throw new Error('El archivo de audio está vacío');
    }

    const normalized = this.normalizeMime(mimeType);
    if (!this.shouldConvert(normalized)) {
      return {
        buffer,
        mimeType: normalized || mimeType,
        fileName: fileName || 'audio',
      };
    }

    try {
      const mp3 = await this.convertToMp3(buffer);
      this.logger.log(
        `Audio convertido ${normalized} → audio/mpeg (${buffer.length} → ${mp3.length} bytes)`,
      );
      return {
        buffer: mp3,
        mimeType: 'audio/mpeg',
        fileName: this.replaceExt(fileName, 'mp3'),
      };
    } catch (e) {
      this.logger.error(
        `Error convirtiendo audio (${normalized}): ${e instanceof Error ? e.message : e}`,
      );
      throw new Error(
        'No se pudo convertir el audio. Verifica que ffmpeg esté instalado en el servidor.',
      );
    }
  }

  convertToMp3(input: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-c:a', 'libmp3lame',
        '-b:a', '32k',
        '-ac', '1',
        '-ar', '24000',
        '-f', 'mp3',
        'pipe:1',
      ]);
      const chunks: Buffer[] = [];
      ffmpeg.stdout.on('data', (c: Buffer) => chunks.push(c));
      let stderr = '';
      ffmpeg.stderr.on('data', (c: Buffer) => {
        stderr += c.toString();
      });
      ffmpeg.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`));
        }
      });
      ffmpeg.on('error', (err: NodeJS.ErrnoException) => {
        reject(
          err.code === 'ENOENT'
            ? new Error('ffmpeg no está instalado en el servidor')
            : err,
        );
      });
      ffmpeg.stdin.end(input);
    });
  }
}
