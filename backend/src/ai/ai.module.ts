import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AssistantInstructionsService } from './assistant-instructions.service';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService, AssistantInstructionsService],
})
export class AiModule {}
