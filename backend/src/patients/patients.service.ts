import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig, Patient } from '../config/supabase.config';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreatePatientDto {
  incident_id: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown' | 'Male' | 'Female' | 'Other';
  mrn?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  chief_complaint?: string;
  medical_history?: string;
  priority?: 'critical' | 'urgent' | 'non_urgent' | 'deceased' | 'expectant';
  triage_priority?: 'red' | 'yellow' | 'green' | 'black';
  observations?: string[];
  local_id?: string;
}

@Injectable()
export class PatientsService {
  constructor(
    private supabaseConfig: SupabaseConfig,
    private realtimeService: RealtimeService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreatePatientDto): Promise<Patient> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    // Map triage_priority to priority if provided
    let priority = dto.priority;
    if (!priority && dto.triage_priority) {
      const triageMap: Record<string, string> = {
        red: 'critical',
        yellow: 'urgent',
        green: 'non_urgent',
        black: 'expectant',
      };
      priority = triageMap[dto.triage_priority] as any;
    }

    // Normalize gender to lowercase
    const gender = dto.gender ? dto.gender.toLowerCase() as any : undefined;

    // Build insert payload - only include fields that exist in the database
    const payload: any = {
      incident_id: dto.incident_id,
      first_name: dto.first_name,
      last_name: dto.last_name,
      date_of_birth: dto.date_of_birth,
      gender,
      mrn: dto.mrn,
      emergency_contact_name: dto.emergency_contact_name,
      emergency_contact_phone: dto.emergency_contact_phone,
      chief_complaint: dto.chief_complaint,
      medical_history: dto.medical_history,
      priority,
      local_id: dto.local_id,
      created_by: user.id,
      updated_by: user.id,
    };

    // Note: observations column needs to be added to Supabase schema
    // For now, store observations in medical_history field as a workaround
    if (dto.observations && dto.observations.length > 0) {
      const observationsText = dto.observations.join(', ');
      if (!payload.medical_history) {
        payload.medical_history = `Observations: ${observationsText}`;
      } else {
        payload.medical_history = `${payload.medical_history}\nObservations: ${observationsText}`;
      }
    }

    const { data, error } = await client
      .from('patients')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create patient: ${error.message}`);
    }

    const patient = data as Patient;

    // Broadcast patient added
    this.realtimeService.broadcastPatientAdded(dto.incident_id, patient);

    return patient;
  }

  async findByIncident(user: AuthenticatedUser, incidentId: string): Promise<Patient[]> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch patients: ${error.message}`);
    }

    return (data || []) as Patient[];
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<Patient> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Patient not found');
    }

    return data as Patient;
  }
}
