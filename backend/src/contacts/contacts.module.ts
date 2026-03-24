import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SyncModule, AuthModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
