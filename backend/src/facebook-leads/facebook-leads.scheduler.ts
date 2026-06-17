import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookLeadsService } from './facebook-leads.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacebookLeadsScheduler {
  private readonly logger = new Logger(FacebookLeadsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookLeads: FacebookLeadsService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'facebook-leads-sync',
    timeZone: 'America/Lima',
  })
  async syncActiveAccounts() {
    const accounts = await this.prisma.facebookAccount.findMany({
      where: { active: true },
    });

    for (const account of accounts) {
      try {
        const result = await this.facebookLeads.syncLeads(account.id);
        if (result.imported > 0) {
          this.logger.log(`Scheduled sync for ${account.pageName}: ${result.imported} new leads`);
        }
      } catch (err) {
        this.logger.error(`Scheduled sync failed for ${account.pageName}: ${err}`);
      }
    }
  }
}
