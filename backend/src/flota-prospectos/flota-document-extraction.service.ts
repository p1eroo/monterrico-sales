import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocumentVisionService,
  type DocumentVisionResult,
} from './document-vision.service';
import { FlotaProspectosGateway } from './flota-prospectos.gateway';
import { ChatwootContactNameSyncService } from '../chatwoot/chatwoot-contact-name-sync.service';

@Injectable()
export class FlotaDocumentExtractionService {
  private readonly logger = new Logger(FlotaDocumentExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vision: DocumentVisionService,
    private readonly prospectosGateway: FlotaProspectosGateway,
    private readonly contactNameSync: ChatwootContactNameSyncService,
  ) {}

  /** Procesa una imagen y fusiona datos extraídos en el prospecto. */
  async processFile(
    prospectoId: string,
    buffer: Buffer,
    mimeType: string,
    originalName?: string,
  ): Promise<DocumentVisionResult | null> {
    if (!this.vision.isConfigured()) return null;

    const result = await this.vision.extractFromDocument(buffer, mimeType);
    if (!result || result.tipoDocumento === 'otro') {
      if (result?.tipoDocumento === 'otro') {
        this.logger.debug(
          `Documento no reconocido (${originalName || 'sin nombre'}) para prospecto ${prospectoId}`,
        );
      }
      return result;
    }

    if (result.confianza < 0.5) {
      this.logger.warn(
        `Extracción con baja confianza (${result.confianza}) prospecto ${prospectoId}`,
      );
    }

    await this.mergeIntoProspecto(prospectoId, result);
    return result;
  }

  /** Procesa varias fotos en paralelo (Flow). */
  async processFiles(
    prospectoId: string,
    files: Array<{ buffer: Buffer; mimeType: string; originalName?: string }>,
  ): Promise<void> {
    if (!files.length || !this.vision.isConfigured()) return;

    await Promise.all(
      files.map((f) =>
        this.processFile(
          prospectoId,
          f.buffer,
          f.mimeType,
          f.originalName,
        ).catch((e) => {
          this.logger.warn(
            `Error extrayendo ${f.originalName || 'archivo'}: ${e instanceof Error ? e.message : e}`,
          );
        }),
      ),
    );
  }

  private async mergeIntoProspecto(
    prospectoId: string,
    result: DocumentVisionResult,
  ): Promise<void> {
    const existing = await this.prisma.flotaProspecto.findUnique({
      where: { id: prospectoId },
    });
    if (!existing) return;

    const data: Record<string, unknown> = {};

    switch (result.tipoDocumento) {
      case 'dni': {
        if (result.dni) data.dni = result.dni;
        if (result.nombresApellidos) {
          data.nombreCompleto = result.nombresApellidos;
        }
        const edad = edadFromFechaNacimiento(result.fechaNacimiento);
        if (edad != null) data.edad = edad;
        break;
      }
      case 'licencia':
        // Brevete del conductor: por ahora no se persiste en ficha de vehículo
        break;
      case 'soat': {
        if (result.placa) data.placa = result.placa;
        break;
      }
      case 'tive': {
        if (result.placa) data.placa = result.placa;
        if (result.anioModelo != null) data.anioVehiculo = result.anioModelo;
        if (result.categoriaVehiculo) {
          data.categoriaVehiculo = result.categoriaVehiculo;
        }
        if (result.marca) data.marca = result.marca;
        if (result.modelo) data.modelo = result.modelo;
        if (result.color) data.color = result.color;
        if (result.combustible) data.combustible = result.combustible;
        break;
      }
      default:
        return;
    }

    if (Object.keys(data).length === 0) return;

    await this.prisma.flotaProspecto.update({
      where: { id: prospectoId },
      data: data as any,
    });

    this.prospectosGateway.emitChange('updated', prospectoId);

    if (
      typeof data.nombreCompleto === 'string' &&
      data.nombreCompleto !== existing.nombreCompleto
    ) {
      void this.contactNameSync.pushNameToChatwoot(
        prospectoId,
        data.nombreCompleto,
      );
    }

    this.logger.log(
      `Prospecto ${prospectoId}: datos fusionados desde ${result.tipoDocumento} (${Object.keys(data).join(', ')})`,
    );
  }

  /** Notifica al frontend (tabla, modales) tras subir archivos sin extracción. */
  notifyProspectoUpdated(prospectoId: string): void {
    this.prospectosGateway.emitChange('updated', prospectoId);
  }
}

function edadFromFechaNacimiento(fecha: string | null): number | null {
  if (!fecha) return null;
  const birth = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
}
