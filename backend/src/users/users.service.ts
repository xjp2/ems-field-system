import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig, UserProfile, UserRole } from '../config/supabase.config';

@Injectable()
export class UsersService {
  constructor(private supabaseConfig: SupabaseConfig) {}

  /**
   * Get user profile by ID
   */
  async findProfileById(id: string): Promise<UserProfile> {
    const client = this.supabaseConfig.getServiceClient();
    
    const { data, error } = await client
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('User profile not found');
    }

    return data as UserProfile;
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    const client = this.supabaseConfig.getServiceClient();
    
    const { data, error } = await client
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      return [];
    }

    return data as UserRole[];
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'badge_number'>>,
  ): Promise<UserProfile> {
    const client = this.supabaseConfig.getServiceClient();
    
    const { data, error } = await client
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Failed to update profile');
    }

    return data as UserProfile;
  }
}
