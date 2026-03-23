import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('El nombre de la empresa es obligatorio');
    }

    return this.prisma.company.create({
      data: {
        name,
        razonSocial: dto.razonSocial?.trim() || null,
        ruc: dto.ruc?.trim() || null,
        telefono: dto.telefono?.trim() || null,
        domain: dto.domain?.trim() || null,
        rubro: dto.rubro?.trim() || null,
        tipo: dto.tipo?.trim() || null,
        linkedin: dto.linkedin?.trim() || null,
        correo: dto.correo?.trim() || null,
        distrito: dto.distrito?.trim() || null,
        provincia: dto.provincia?.trim() || null,
        departamento: dto.departamento?.trim() || null,
        direccion: dto.direccion?.trim() || null,
      },
    });
  }

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);

    const data: Record<string, string | null | undefined> = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      data.name = name;
    }
    if (dto.razonSocial !== undefined) {
      data.razonSocial = dto.razonSocial?.trim() || null;
    }
    if (dto.ruc !== undefined) data.ruc = dto.ruc?.trim() || null;
    if (dto.telefono !== undefined) data.telefono = dto.telefono?.trim() || null;
    if (dto.domain !== undefined) data.domain = dto.domain?.trim() || null;
    if (dto.rubro !== undefined) data.rubro = dto.rubro?.trim() || null;
    if (dto.tipo !== undefined) data.tipo = dto.tipo?.trim() || null;
    if (dto.linkedin !== undefined) data.linkedin = dto.linkedin?.trim() || null;
    if (dto.correo !== undefined) data.correo = dto.correo?.trim() || null;
    if (dto.distrito !== undefined) data.distrito = dto.distrito?.trim() || null;
    if (dto.provincia !== undefined) data.provincia = dto.provincia?.trim() || null;
    if (dto.departamento !== undefined) {
      data.departamento = dto.departamento?.trim() || null;
    }
    if (dto.direccion !== undefined) data.direccion = dto.direccion?.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.company.delete({
      where: { id },
    });
  }
}
