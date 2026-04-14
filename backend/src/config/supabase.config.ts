import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Database types generated from Supabase schema
 * These match the tables created by doctorSupabase migrations
 */
export type IncidentStatus = 
  | 'draft' 
  | 'dispatched' 
  | 'en_route' 
  | 'on_scene' 
  | 'transporting' 
  | 'arrived' 
  | 'closed' 
  | 'cancelled';

export type PriorityLevel = 
  | 'critical' 
  | 'urgent' 
  | 'non_urgent' 
  | 'deceased' 
  | 'expectant';

export type AppRole = 'FIELD' | 'COMMAND' | 'ADMIN';

export type InterventionType = 
  | 'medication' 
  | 'procedure' 
  | 'airway' 
  | 'iv_access' 
  | 'monitoring' 
  | 'other';

export interface Incident {
  id: string;
  incident_number: string;
  address: string;
  latitude?: number;
  longitude?: number;
  location_description?: string;
  status: IncidentStatus;
  priority?: PriorityLevel;
  hospital_id?: string;
  dispatched_at?: string;
  en_route_at?: string;
  on_scene_at?: string;
  transporting_at?: string;
  arrived_at?: string;
  closed_at?: string;
  estimated_arrival?: string;
  chief_complaint?: string;
  scene_description?: string;
  local_id?: string;
  device_id?: string;
  synced_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface Patient {
  id: string;
  incident_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  mrn?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  chief_complaint?: string;
  medical_history?: string;
  priority?: PriorityLevel;
  triaged_at?: string;
  local_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface Vital {
  id: string;
  patient_id: string;
  recorded_at: string;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  temperature?: number;
  blood_glucose?: number;
  gcs_total?: number;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  pain_score?: number;
  etco2?: number;
  notes?: string;
  local_id?: string;
  created_at: string;
  created_by?: string;
}

export interface Intervention {
  id: string;
  patient_id: string;
  performed_at: string;
  type: InterventionType;
  name: string;
  dosage?: string;
  route?: string;
  indication?: string;
  response?: string;
  notes?: string;
  local_id?: string;
  created_at: string;
  created_by?: string;
}

export interface Photo {
  id: string;
  incident_id: string;
  storage_path: string;
  public_url?: string;
  caption?: string;
  taken_at: string;
  created_at: string;
  created_by?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  badge_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_at: string;
  assigned_by?: string;
}

@Injectable()
export class SupabaseConfig {
  private serviceClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
    }

    this.serviceClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Get service role client for admin operations
   * Bypasses RLS - use with caution
   */
  getServiceClient(): SupabaseClient {
    return this.serviceClient;
  }

  /**
   * Create a client authenticated as a specific user
   * Respects RLS policies for that user
   */
  getClientForUser(jwt: string): SupabaseClient {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    
    return createClient(url, this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY')!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      },
    });
  }
}
