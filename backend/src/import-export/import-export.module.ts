import { Module } from '@nestjs/common';
import { ImportExportController } from './import-export.controller';
import { ImportExportJobsService } from './import-export-jobs.service';
import { ImportExportService } from './import-export.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ContactsModule } from '../contacts/contacts.module';
import { CompaniesModule } from '../companies/companies.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { FactilizaModule } from '../factiliza/factiliza.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ContactsModule,
    CompaniesModule,
    OpportunitiesModule,
    FactilizaModule,
    CrmConfigModule,
    SyncModule,
  ],
  controllers: [ImportExportController],
  providers: [ImportExportService, ImportExportJobsService],
})
export class ImportExportModule {}
