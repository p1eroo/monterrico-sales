import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { MAX_KNOWLEDGE_UPLOAD_FILE_BYTES } from './knowledge-ingest.constants';
import { KnowledgeBasesService } from './knowledge-bases.service';

type AuthedReq = {
  user: {
    userId: string;
    username: string;
    name: string;
    role: string;
    roleId?: string;
  };
};

@Controller('api/ai/knowledge-bases')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBasesService: KnowledgeBasesService) {}

  @Get()
  list(@Req() req: AuthedReq) {
    return this.knowledgeBasesService.listForUser(req.user.userId);
  }

  @Post()
  create(@Body() body: CreateKnowledgeBaseDto, @Req() req: AuthedReq) {
    return this.knowledgeBasesService.createForUser(req.user.userId, body);
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 32, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_KNOWLEDGE_UPLOAD_FILE_BYTES },
    }),
  )
  upload(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() body: Record<string, string>,
    @Req() req: AuthedReq,
  ) {
    const title = body?.title?.trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    const list = files ?? [];
    if (!list.length) {
      throw new BadRequestException('Adjunta al menos un archivo');
    }
    return this.knowledgeBasesService.createFromUpload(req.user.userId, list, {
      title,
      chunkSize: body?.chunkSize,
      overlap: body?.overlap,
      linkedAgentId: body?.linkedAgentId?.trim(),
      linkedAgentName: body?.linkedAgentName?.trim(),
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.knowledgeBasesService.deleteForUser(req.user.userId, id);
  }
}
