import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

type AuthedReq = { user: { userId: string; name: string } };

@Controller('opportunities')
@UseGuards(PermissionsGuard)
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @RequirePermissions('oportunidades.crear')
  create(
    @Body() createOpportunityDto: CreateOpportunityDto,
    @Req() req: AuthedReq,
  ) {
    return this.opportunitiesService.create(createOpportunityDto, {
      userId: req.user.userId,
      userName: req.user.name,
    });
  }

  @Get()
  @RequirePermissions('oportunidades.ver')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('etapa') etapa?: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.opportunitiesService.findAll({
      page: pageNum,
      limit: limitNum,
      search: search?.trim() || undefined,
      etapa: etapa?.trim() || undefined,
      status: status?.trim() || undefined,
      assignedTo: assignedTo?.trim() || undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('oportunidades.ver')
  findOne(@Param('id') id: string) {
    return this.opportunitiesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('oportunidades.editar')
  update(
    @Param('id') id: string,
    @Body() updateOpportunityDto: UpdateOpportunityDto,
    @Req() req: AuthedReq,
  ) {
    return this.opportunitiesService.update(id, updateOpportunityDto, {
      userId: req.user.userId,
      userName: req.user.name,
    });
  }

  @Delete(':id')
  @RequirePermissions('oportunidades.eliminar')
  remove(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.opportunitiesService.remove(id, {
      userId: req.user.userId,
      userName: req.user.name,
    });
  }
}
