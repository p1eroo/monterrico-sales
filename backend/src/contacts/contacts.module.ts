import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';

@Module({
  imports: [SyncModule, AuthModule, CrmConfigModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
