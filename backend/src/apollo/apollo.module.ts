import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApolloController } from './apollo.controller';
import { ApolloService } from './apollo.service';

@Module({
  imports: [AuthModule],
  controllers: [ApolloController],
  providers: [ApolloService],
  exports: [ApolloService],
})
export class ApolloModule {}
