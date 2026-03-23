import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { LinkCompanyDto } from './dto/link-company.dto';
import { LinkContactDto } from './dto/link-contact.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  create(@Body() createContactDto: CreateContactDto) {
    return this.contactsService.create(createContactDto);
  }

  @Get()
  findAll() {
    return this.contactsService.findAll();
  }

  @Post(':id/companies')
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
  removeCompany(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
  ) {
    return this.contactsService.removeCompany(id, companyId);
  }

  @Post(':id/links')
  addLinkedContact(
    @Param('id') id: string,
    @Body() dto: LinkContactDto,
  ) {
    return this.contactsService.addLinkedContact(id, dto.linkedContactId.trim());
  }

  @Delete(':id/links/:linkedId')
  removeLinkedContact(
    @Param('id') id: string,
    @Param('linkedId') linkedId: string,
  ) {
    return this.contactsService.removeLinkedContact(id, linkedId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateContactDto: UpdateContactDto) {
    return this.contactsService.update(id, updateContactDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id);
  }
}
