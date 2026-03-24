import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { LinkCompanyDto } from './dto/link-company.dto';
import { LinkContactDto } from './dto/link-contact.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('contacts')
@UseGuards(PermissionsGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @RequirePermissions('contactos.crear')
  create(@Body() createContactDto: CreateContactDto) {
    return this.contactsService.create(createContactDto);
  }

  @Get()
  @RequirePermissions('contactos.ver')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('etapa') etapa?: string,
    @Query('fuente') fuente?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25)) : 25;
    return this.contactsService.findAll({
      page: pageNum,
      limit: limitNum,
      search: search?.trim() || undefined,
      etapa: etapa?.trim() || undefined,
      fuente: fuente?.trim() || undefined,
      assignedTo: assignedTo?.trim() || undefined,
    });
  }

  @Post(':id/companies')
  @RequirePermissions('contactos.editar')
  addCompany(
    @Param('id') id: string,
    @Body() dto: LinkCompanyDto,
  ) {
    return this.contactsService.addCompany(
      id,
      dto.companyId.trim(),
      dto.isPrimary ?? false,
    );
  }

  @Delete(':id/companies/:companyId')
  @RequirePermissions('contactos.editar')
  removeCompany(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
  ) {
    return this.contactsService.removeCompany(id, companyId);
  }

  @Post(':id/links')
  @RequirePermissions('contactos.editar')
  addLinkedContact(
    @Param('id') id: string,
    @Body() dto: LinkContactDto,
  ) {
    return this.contactsService.addLinkedContact(id, dto.linkedContactId.trim());
  }

  @Delete(':id/links/:linkedId')
  @RequirePermissions('contactos.editar')
  removeLinkedContact(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    return this.contactsService.removeLinkedContact(id, linkedId);
  }

  @Get(':id')
  @RequirePermissions('contactos.ver')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('contactos.editar')
  update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(':id')
  @RequirePermissions('contactos.eliminar')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
