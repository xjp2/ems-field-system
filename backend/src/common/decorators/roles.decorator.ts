import { SetMetadata } from '@nestjs/common';
import { AppRole } from '../../config/supabase.config';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route
 * 
 * @example
 * @Roles('COMMAND')
 * @Get('active')
 * getActiveIncidents() { ... }
 * 
 * @example
 * @Roles('COMMAND', 'ADMIN')
 * @Delete(':id')
 * deleteIncident() { ... }
 * 
 * @example
 * @Roles('FIELD', 'COMMAND', 'ADMIN')  // Any authenticated user
 * @Get(':id')
 * getIncident() { ... }
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
