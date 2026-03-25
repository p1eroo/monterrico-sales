import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CrmConfigService } from './crm-config.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

type AuthedReq = {
  user: { userId: string };
};

@Controller('crm-config')
@UseGuards(PermissionsGuard)
export class CrmConfigController {
  constructor(private readonly crmConfig: CrmConfigService) {}

  /** Catálogo + organización + metas (equipo solo con `configuracion.ver`). Cualquier JWT. */
  @Get()
  getBundle(@Req() req: AuthedReq) {
    return this.crmConfig.getBundle(req.user.userId);
  }

  @Patch('organization')
  @RequirePermissions('configuracion.editar')
  patchOrganization(
    @Req() req: AuthedReq,
    @Body()
    body: {
      name?: string;
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
      address?: string;
    },
  ) {
    return this.crmConfig.patchOrganization(req.user.userId, body);
  }

  @Put('lead-sources')
  @RequirePermissions('configuracion.editar')
  putLeadSources(
    @Req() req: AuthedReq,
    @Body() body: { items: { slug: string; name: string; enabled: boolean }[] },
  ) {
    if (!Array.isArray(body?.items)) {
      throw new BadRequestException('items debe ser un array');
    }
    return this.crmConfig.putLeadSources(req.user.userId, body.items);
  }

  @Put('stages')
  @RequirePermissions('configuracion.editar')
  putStages(
    @Req() req: AuthedReq,
    @Body()
    body: {
      items: {
        slug: string;
        name: string;
        color: string;
        probability: number;
        enabled: boolean;
        isSystem?: boolean;
      }[];
    },
  ) {
    if (!Array.isArray(body?.items)) {
      throw new BadRequestException('items debe ser un array');
    }
    return this.crmConfig.putStages(req.user.userId, body.items);
  }

  @Put('priorities')
  @RequirePermissions('configuracion.editar')
  putPriorities(
    @Req() req: AuthedReq,
    @Body()
    body: {
      items: {
        slug: string;
        name: string;
        color: string;
        description: string;
        enabled: boolean;
      }[];
    },
  ) {
    if (!Array.isArray(body?.items)) {
      throw new BadRequestException('items debe ser un array');
    }
    return this.crmConfig.putPriorities(req.user.userId, body.items);
  }

  @Put('activity-types')
  @RequirePermissions('configuracion.editar')
  putActivityTypes(
    @Req() req: AuthedReq,
    @Body() body: { items: { slug: string; name: string; enabled: boolean }[] },
  ) {
    if (!Array.isArray(body?.items)) {
      throw new BadRequestException('items debe ser un array');
    }
    return this.crmConfig.putActivityTypes(req.user.userId, body.items);
  }

  @Put('sales-goals')
  @RequirePermissions('configuracion.editar')
  putSalesGoals(
    @Req() req: AuthedReq,
    @Body()
    body: {
      globalWeekly: number;
      globalMonthly: number;
      byUserId: Record<string, { weekly?: number; monthly?: number }>;
    },
  ) {
    return this.crmConfig.putSalesGoals(req.user.userId, body);
  }
}
