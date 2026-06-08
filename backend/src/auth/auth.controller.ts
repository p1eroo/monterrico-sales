import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';

const avatarMemory = memoryStorage();
const AVATAR_IMAGE_RE = /^image\/(jpeg|png|webp|gif)$/i;

type AuthedReq = {
  user: { userId: string };
  headers: { authorization?: string };
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /** Permisos desde BD (Authority); misma fuente que el guard. */
  @Get('me')
  async me(@Req() req: AuthedReq) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('me')
  async patchMe(
    @Body() body: { name?: string; phone?: string },
    @Req() req: AuthedReq,
  ) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: avatarMemory,
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Req() req: AuthedReq,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo (campo file)');
    }
    if (!AVATAR_IMAGE_RE.test(file.mimetype || '')) {
      throw new BadRequestException(
        'Solo se permiten imágenes JPEG, PNG, WebP o GIF',
      );
    }
    const auth =
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined;
    return this.authService.updateAvatar(
      req.user.userId,
      file.buffer,
      file.mimetype || 'image/jpeg',
      file.originalname || 'avatar.jpg',
      auth,
    );
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  /** Crear usuario (solo si no hay usuarios aún o ALLOW_OPEN_REGISTRATION=true) */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** Usuario autenticado cambia su propia contraseña */
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.authService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
