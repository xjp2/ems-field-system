import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfig } from '../config/supabase.config';
import { JwtPayload, AuthenticatedUser } from './types/jwt-payload.type';
import * as jwt from 'jsonwebtoken';

/**
 * Authentication service for validating tokens and managing sessions
 */
@Injectable()
export class AuthService {
  constructor(
    private supabaseConfig: SupabaseConfig,
    private configService: ConfigService,
  ) {}

  /**
   * Validate a JWT token and return the authenticated user
   * Used by guards to verify requests
   */
  async validateToken(token: string): Promise<AuthenticatedUser> {
    try {
      const jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('SUPABASE_JWT_SECRET not configured');
      }

      const payload = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      const roles = payload.app_metadata?.roles || [];

      return {
        id: payload.sub,
        email: payload.email || '',
        roles,
        jwt: token,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get user profile from Supabase
   */
  async getUserProfile(userId: string) {
    const client = this.supabaseConfig.getServiceClient();
    
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new UnauthorizedException('User not found');
    }

    return data;
  }

  /**
   * Get user roles from Supabase
   */
  async getUserRoles(userId: string) {
    const client = this.supabaseConfig.getServiceClient();
    
    const { data, error } = await client
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      return [];
    }

    return data.map((r) => r.role);
  }
}
