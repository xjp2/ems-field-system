import { AppRole } from '../../config/supabase.config';

/**
 * JWT Payload structure from Supabase Auth
 * Matches the claims in the JWT token issued by Supabase
 */
export interface JwtPayload {
  /** User ID (UUID) */
  sub: string;
  
  /** Token audience */
  aud: string;
  
  /** Token expiration timestamp */
  exp: number;
  
  /** Token issued at timestamp */
  iat: number;
  
  /** User's email */
  email?: string;
  
  /** User's phone */
  phone?: string;
  
  /** App metadata (roles stored here by trigger) */
  app_metadata?: {
    roles?: AppRole[];
  };
  
  /** User metadata */
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  
  /** User roles (populated by auth middleware) */
  roles?: AppRole[];
}

/**
 * Authenticated user object attached to request
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: AppRole[];
  jwt: string;
}
