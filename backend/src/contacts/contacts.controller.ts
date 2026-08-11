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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { LinkCompanyDto } from './dto/link-company.dto';
import { LinkContactDto } from './dto/link-contact.dto';
import { BulkDeleteContactsDto } from './dto/bulk-delete-contacts.dto';
import { BulkReassignContactsDto } from './dto/bulk-reassign-contacts.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';

type AuthedReq = {
  user: { userId: string; name: string; roleId?: string };
};

@Controller('contacts')
@UseGuards(PermissionsGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Post()
  @RequirePermissions('contactos.crear')
  async create(
    @Body() createContactDto: CreateContactDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.contactsService.create(
      createContactDto,
      {
        userId: req.user.userId,
        userName: req.user.name,
      },
      scope,
    );
  }

  @Get()
  @RequirePermissions('contactos.ver')
  async findAll(
    @Req() req: AuthedReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('etapa') etapa?: string,
    @Query('fuente') fuente?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('linkedToCompany') linkedToCompany?: string,
    @Query('excludeCompanyLink') excludeCompanyLink?: string,
    @Query('excludeOpportunityLink') excludeOpportunityLink?: string,
    @Query('lastInteraction') lastInteraction?: string,
    @Query('lastInteractionFrom') lastInteractionFrom?: string,
    @Query('lastInteractionTo') lastInteractionTo?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25)) : 25;
    return this.contactsService.findAll(
      {
        page: pageNum,
        limit: limitNum,
        search: search?.trim() || undefined,
        etapa: etapa?.trim() || undefined,
        fuente: fuente?.trim() || undefined,
        assignedTo: assignedTo?.trim() || undefined,
        excludeAssignedTo: excludeAssignedTo?.trim() || undefined,
        advisorPool: advisorPool?.trim() || undefined,
        linkedToCompanyId: linkedToCompany?.trim() || undefined,
        excludeCompanyLinkId: excludeCompanyLink?.trim() || undefined,
        excludeOpportunityLinkId: excludeOpportunityLink?.trim() || undefined,
        lastInteraction: lastInteraction?.trim() || undefined,
        lastInteractionFrom: lastInteractionFrom?.trim() || undefined,
        lastInteractionTo: lastInteractionTo?.trim() || undefined,
        createdFrom: createdFrom?.trim() || undefined,
        createdTo: createdTo?.trim() || undefined,
      },
      scope,
    );
  }

  @Get('etapa-counts')
  @RequirePermissions('contactos.ver')
  async etapaTabCounts(
    @Req() req: AuthedReq,
    @Query('search') search?: string,
    @Query('fuente') fuente?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('lastInteraction') lastInteraction?: string,
    @Query('lastInteractionFrom') lastInteractionFrom?: string,
    @Query('lastInteractionTo') lastInteractionTo?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.contactsService.etapaTabCounts(
      {
        search: search?.trim() || undefined,
        fuente: fuente?.trim() || undefined,
        assignedTo: assignedTo?.trim() || undefined,
        excludeAssignedTo: excludeAssignedTo?.trim() || undefined,
        advisorPool: advisorPool?.trim() || undefined,
        lastInteraction: lastInteraction?.trim() || undefined,
        lastInteractionFrom: lastInteractionFrom?.trim() || undefined,
        lastInteractionTo: lastInteractionTo?.trim() || undefined,
        createdFrom: createdFrom?.trim() || undefined,
        createdTo: createdTo?.trim() || undefined,
      },
      scope,
    );
  }

  @Post(':id/companies')
  @RequirePermissions('contactos.editar')
  addCompany(
    @Param('id') id: string,
    @Body() dto: LinkCompanyDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.contactsService.addCompany(
          id,
          dto.companyId.trim(),
          dto.isPrimary ?? false,
          { userId: req.user.userId, userName: req.user.name },
          scope,
        ),
      );
  }

  @Delete(':id/companies/:companyId')
  @RequirePermissions('contactos.editar')
  removeCompany(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.contactsService.removeCompany(id, companyId, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }

  @Post(':id/links')
  @RequirePermissions('contactos.editar')
  addLinkedContact(
    @Param('id') id: string,
    @Body() dto: LinkContactDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.contactsService.addLinkedContact(
          id,
          dto.linkedContactId.trim(),
          { userId: req.user.userId, userName: req.user.name },
          scope,
        ),
      );
  }

  @Delete(':id/links/:linkedId')
  @RequirePermissions('contactos.editar')
  removeLinkedContact(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.contactsService.removeLinkedContact(id, linkedId, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }

  @Get(':id')
  @RequireAnyPermission('contactos.ver', 'flota_prospectos.ver', 'flota_mensajes.ver')
  findOne(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.contactsService.findOne(id, scope));
  }

  @Patch(':id')
  @RequireAnyPermission('contactos.editar', 'flota_prospectos.editar', 'flota_mensajes.editar')
  update(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.contactsService.update(id, updateContactDto, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }

  @Post('bulk-delete')
  @RequirePermissions('contactos.eliminar')
  async bulkRemove(
    @Body() body: BulkDeleteContactsDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.contactsService.bulkRemove(
      {
        ids: body.ids,
        selectAll: body.selectAll,
        search: body.search?.trim() || undefined,
        etapa: body.etapa?.trim() || undefined,
        fuente: body.fuente?.trim() || undefined,
        assignedTo: body.assignedTo?.trim() || undefined,
        excludeAssignedTo: body.excludeAssignedTo?.trim() || undefined,
        advisorPool: body.advisorPool?.trim() || undefined,
        linkedToCompanyId: body.linkedToCompany?.trim() || undefined,
        excludeCompanyLinkId: body.excludeCompanyLink?.trim() || undefined,
        excludeOpportunityLinkId: body.excludeOpportunityLink?.trim() || undefined,
        lastInteraction: body.lastInteraction?.trim() || undefined,
        lastInteractionFrom: body.lastInteractionFrom?.trim() || undefined,
        lastInteractionTo: body.lastInteractionTo?.trim() || undefined,
        createdFrom: body.createdFrom?.trim() || undefined,
        createdTo: body.createdTo?.trim() || undefined,
      },
      {
        userId: req.user.userId,
        userName: req.user.name,
      },
      scope,
    );
  }

  @Post('bulk-reassign')
  @RequirePermissions('contactos.editar')
  async bulkReassign(
    @Body() body: BulkReassignContactsDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.contactsService.bulkReassign(
      {
        newAssignedTo: body.newAssignedTo?.trim() || '',
        ids: body.ids,
        selectAll: body.selectAll,
        search: body.search?.trim() || undefined,
        etapa: body.etapa?.trim() || undefined,
        fuente: body.fuente?.trim() || undefined,
        assignedTo: body.assignedTo?.trim() || undefined,
        excludeAssignedTo: body.excludeAssignedTo?.trim() || undefined,
        advisorPool: body.advisorPool?.trim() || undefined,
        linkedToCompanyId: body.linkedToCompany?.trim() || undefined,
        excludeCompanyLinkId: body.excludeCompanyLink?.trim() || undefined,
        excludeOpportunityLinkId: body.excludeOpportunityLink?.trim() || undefined,
        lastInteraction: body.lastInteraction?.trim() || undefined,
        lastInteractionFrom: body.lastInteractionFrom?.trim() || undefined,
        lastInteractionTo: body.lastInteractionTo?.trim() || undefined,
        createdFrom: body.createdFrom?.trim() || undefined,
        createdTo: body.createdTo?.trim() || undefined,
      },
      {
        userId: req.user.userId,
        userName: req.user.name,
      },
      scope,
    );
  }

  @Delete(':id')
  @RequirePermissions('contactos.eliminar')
  remove(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.contactsService.remove(id, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }
}
