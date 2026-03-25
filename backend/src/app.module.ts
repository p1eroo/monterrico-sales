import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { ContactsModule } from './contacts/contacts.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { ActivitiesModule } from './activities/activities.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { FactilizaModule } from './factiliza/factiliza.module';
import { RolesModule } from './roles/roles.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClientsModule } from './clients/clients.module';
import { FilesModule } from './files/files.module';
import { CrmConfigModule } from './crm-config/crm-config.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ImportExportModule } from './import-export/import-export.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    RolesModule,
    CompaniesModule,
    ContactsModule,
    OpportunitiesModule,
    ActivitiesModule,
    AuthModule,
    FactilizaModule,
    CampaignsModule,
    ClientsModule,
    FilesModule,
    CrmConfigModule,
    AnalyticsModule,
    ImportExportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
