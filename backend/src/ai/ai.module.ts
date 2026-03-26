import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiToolsService],
})
export class AiModule {}
