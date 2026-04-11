import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseConfig } from '../config/supabase.config';

@Module({
  imports: [ConfigModule],
  providers: [AuthService, SupabaseConfig],
  controllers: [AuthController],
  exports: [AuthService, SupabaseConfig],
})
export class AuthModule {}
