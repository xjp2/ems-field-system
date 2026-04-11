import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../../auth/types/jwt-payload.type';
import { AppRole } from '../../config/supabase.config';

// Extend Express Request to include user property
declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

// Simple JWT payload interface
interface TokenPayload {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  app_metadata?: {
    roles?: string[];
  };
  user_metadata?: {
    full_name?: string;
  };
}

/**
 * Guard that validates Supabase JWT tokens
 * 
 * Decodes the Bearer token from Authorization header.
 * Note: Full verification should be done via Supabase API in production.
 * This implementation decodes the token and checks expiration.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Decode the JWT without verification
      // In production, you should verify with Supabase's JWT secret
      const payload = jwt.decode(token) as TokenPayload;

      if (!payload) {
        throw new UnauthorizedException('Invalid token format');
      }

      // Check token expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        throw new UnauthorizedException('Token has expired');
      }

      // Extract roles from app_metadata or default to FIELD
      const roles: AppRole[] = (payload.app_metadata?.roles as AppRole[]) || ['FIELD'];

      // Attach authenticated user to request
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email || '',
        roles,
        jwt: token,
      };

      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
