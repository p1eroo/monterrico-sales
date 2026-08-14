import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { EmailSignatureService } from './email-signature.service';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';
import { CompaniesModule } from '../companies/companies.module';
import { FilesModule } from '../files/files.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [AuthModule, SyncModule, CompaniesModule, FilesModule, MediaModule],
  providers: [GmailService, EmailSignatureService],
  controllers: [GmailController],
  exports: [GmailService],
})
export class GmailModule {}
