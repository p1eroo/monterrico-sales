import { Controller, Get, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { FactilizaService } from './factiliza.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma';

@Controller('factiliza')
@UseGuards(PermissionsGuard)
export class FactilizaController {
  constructor(
    private readonly factilizaService: FactilizaService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('ruc/:ruc')
  @RequirePermissions('empresas.ver')
  async consultarRuc(@Param('ruc') ruc: string) {
    const digits = ruc.replace(/\D/g, '').trim();
    if (digits.length === 11) {
      const existing = await this.prisma.company.findFirst({
        where: {
          OR: [
            { ruc: digits },
            { ruc: ruc.trim() },
          ],
        },
        include: { user: { select: { name: true } } },
      });

      if (existing) {
        throw new BadRequestException(
          `La empresa ya se encuentra registrada. \n Por: ${existing.user?.name ?? 'Sistema (Sin asignar)'}`,
        );
      }
    }
    return this.factilizaService.consultarRuc(ruc);
  }
}
