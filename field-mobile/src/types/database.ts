/**
 * Database types matching Supabase schema
 * Local SQLite mirrors these with additional sync metadata
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

export type TriageLevel = 'red' | 'yellow' | 'green' | 'black';

/**
 * Incident entity - stored locally and synced to server
 */
export interface Incident {
  // Local fields
  id: string;                    // Local UUID
  is_synced: boolean;
  sync_error?: string;
  pending_changes?: string;
  
  // Server fields (null until synced)
  server_id?: string;
  
  // Core fields
  incident_number: string;
  address: string;
  latitude?: number;
  longitude?: number;
  location_description?: string;
  status: IncidentStatus;
  priority?: PriorityLevel;
  chief_complaint?: string;
  scene_description?: string;
  
  // Timestamps
  dispatched_at?: string;
  en_route_at?: string;
  on_scene_at?: string;
  transporting_at?: string;
  arrived_at?: string;
  closed_at?: string;
  estimated_arrival?: string;
  
  // Sync metadata
  local_id?: string;
  device_id?: string;
  
  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

/**
 * Patient entity
 */
export interface Patient {
  // Local fields
  id: string;
  is_synced: boolean;
  
  // Server fields
  server_id?: string;
  server_incident_id?: string;
  
  // Relationships
  incident_id: string;           // Local incident ID
  
  // Identity
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  mrn?: string;
  
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  
  // Clinical
  chief_complaint?: string;
  medical_history?: string;
  triage_priority: TriageLevel;
  observations: string[];        // JSON array of observations
  
  // Timestamps
  triaged_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Vital signs entity
 */
export interface Vital {
  id: string;
  is_synced: boolean;
  server_id?: string;
  server_patient_id?: string;
  
  patient_id: string;
  
  recorded_at: string;
  
  // Vital signs
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  temperature?: number;
  blood_glucose?: number;
  
  // GCS
  gcs_total?: number;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  
  pain_score?: number;
  etco2?: number;
  notes?: string;
  
  created_at: string;
  created_by?: string;
}

/**
 * Intervention/procedure entity
 */
export interface Intervention {
  id: string;
  is_synced: boolean;
  server_id?: string;
  server_patient_id?: string;
  
  patient_id: string;
  
  performed_at: string;
  type: InterventionType;
  name: string;
  dosage?: string;
  route?: string;
  indication?: string;
  response?: string;
  notes?: string;
  
  created_at: string;
  created_by?: string;
}

/**
 * Photo entity for incident photos
 */
export interface Photo {
  id: string;
  is_synced: boolean;
  server_id?: string;
  
  incident_id: string;
  server_incident_id?: string;
  
  uri: string;              // Local file URI
  caption?: string;
  taken_at: string;         // When photo was taken
  
  created_at: string;
}

/**
 * Sync queue entry for pending operations
 */
export interface SyncQueueEntry {
  id: string;
  table_name: 'incidents' | 'patients' | 'vitals' | 'interventions' | 'photos';
  local_id: string;
  server_id?: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;              // JSON string
  retry_count: number;
  last_error?: string;
  priority: number;             // 0=normal, 1=high
  created_at: string;
}

/**
 * User profile from Supabase
 */
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

/**
 * Authenticated user
 */
export interface AuthUser {
  id: string;
  email: string;
  roles: AppRole[];
  jwt: string;
  profile?: UserProfile;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  operations_completed: number;
  operations_failed: number;
  errors: string[];
}
