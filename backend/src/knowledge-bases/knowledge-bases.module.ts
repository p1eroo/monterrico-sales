import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Module({
  imports: [AiModule],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
