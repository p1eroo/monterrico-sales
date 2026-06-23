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
  Res,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
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

  @Get('google/status')
  async googleStatus(@Req() req: AuthedReq) {
    return this.authService.getGoogleStatus(req.user.userId);
  }

  @Post('google/disconnect')
  async googleDisconnect(@Req() req: AuthedReq) {
    await this.authService.disconnectGoogle(req.user.userId);
    return { ok: true };
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

  @Public()
  @Get('google')
  async googleAuth(@Query('state') state: string, @Res() res: any) {
    if (!state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?error=no_state`);
    }
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      scope: [
        'openid', 'email', 'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/tasks',
      ],
    });
    res.redirect(authUrl);
  }

  @Public()
  @Get('google/callback')
  async googleAuthRedirect(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (!code || !state) {
      return res.redirect(`${frontendUrl}/auth/callback?error=invalid_params`);
    }
    try {
      const success = await this.authService.linkGoogleAccountWithCode(state, code);
      if (success) {
        return res.redirect(`${frontendUrl}/auth/callback?connected=true`);
      }
    } catch {}
    // Fallback: create new user (existing flow)
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const googleUser = {
      googleId: profile.data.emailAddress ?? code.slice(0, 10),
      email: profile.data.emailAddress ?? '',
      firstName: '',
      lastName: '',
      accessToken: tokens.access_token ?? '',
      refreshToken: tokens.refresh_token ?? '',
    };
    const jwt = await this.authService.googleLogin(googleUser);
    res.redirect(`${frontendUrl}/auth/callback?token=${jwt.accessToken}`);
  }

  @Public()
  @Post('google/init')
  async googleInit(@Body() body: { token?: string }) {
    if (!body.token) {
      throw new UnauthorizedException('Se requiere token de autenticación');
    }
    const state = await this.authService.createPendingGoogleState(body.token);
    return { state };
  }
}
