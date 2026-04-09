import { Module } from '@nestjs/common';
import { AuditDetailService } from './audit-detail.service';
import { AuditDetailController } from './audit-detail.controller';

@Module({
  controllers: [AuditDetailController],
  providers: [AuditDetailService],
  exports: [AuditDetailService],
})
export class AuditDetailModule {}
