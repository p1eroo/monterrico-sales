import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { JWT_SECRET } from './auth.constants';
import { MediaModule } from '../media/media.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { CrmDataScopeService } from './crm-data-scope.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    MediaModule,
    ActivityLogsModule,
  ],
  providers: [AuthService, JwtStrategy, PermissionsGuard, CrmDataScopeService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PermissionsGuard, CrmDataScopeService],
})
export class AuthModule {}