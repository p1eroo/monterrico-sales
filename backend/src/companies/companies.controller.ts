import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('rubro') rubro?: string,
    @Query('tipo') tipo?: string,
  ) {
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.companiesService.findAll({
      page: pageNum,
      limit: limitNum,
      search: search?.trim() || undefined,
      rubro: rubro?.trim() || undefined,
      tipo: tipo?.trim() || undefined,
    });
  }

  /** Debe ir antes de @Get(':id') para no capturar "summary" como id. */
  @Get('summary')
  findAllSummary(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('rubro') rubro?: string,
    @Query('tipo') tipo?: string,
    @Query('etapa') etapa?: string,
    @Query('fuente') fuente?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.companiesService.findAllSummary({
      page: pageNum,
      limit: limitNum,
      search: search?.trim() || undefined,
      rubro: rubro?.trim() || undefined,
      tipo: tipo?.trim() || undefined,
      etapa: etapa?.trim() || undefined,
      fuente: fuente?.trim() || undefined,
      assignedTo: assignedTo?.trim() || undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
