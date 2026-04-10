import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { AiModule } from './ai/ai.module';
import { KnowledgeBasesModule } from './knowledge-bases/knowledge-bases.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { AuditDetailModule } from './audit-detail/audit-detail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

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
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 30,
        },
      ],
      getTracker: (req: Record<string, unknown>) => {
        const u = (req as { user?: { userId?: string } }).user?.userId;
        if (typeof u === 'string' && u.length > 0) return `ai:${u}`;
        const ip = (req as { ip?: string }).ip;
        return typeof ip === 'string' ? ip : 'anon';
      },
    }),
    AiModule,
    KnowledgeBasesModule,
    ActivityLogsModule,
    AuditDetailModule,
    NotificationsModule,
    WhatsappModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
