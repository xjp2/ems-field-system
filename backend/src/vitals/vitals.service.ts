import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig, Vital } from '../config/supabase.config';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateVitalDto {
  patient_id: string;
  recorded_at?: string;
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
}

@Injectable()
export class VitalsService {
  constructor(
    private supabaseConfig: SupabaseConfig,
    private realtimeService: RealtimeService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateVitalDto): Promise<Vital> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('vitals')
      .insert({
        ...dto,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record vital: ${error.message}`);
    }

    const vital = data as Vital;

    // Get incident_id for broadcasting
    const { data: patient } = await client
      .from('patients')
      .select('incident_id')
      .eq('id', dto.patient_id)
      .single();

    if (patient) {
      this.realtimeService.broadcastVitalsAdded(
        patient.incident_id,
        dto.patient_id,
        vital,
      );
    }

    return vital;
  }

  async findByPatient(user: AuthenticatedUser, patientId: string): Promise<Vital[]> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('vitals')
      .select('*')
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch vitals: ${error.message}`);
    }

    return (data || []) as Vital[];
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<Vital> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('vitals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Vital not found');
    }

    return data as Vital;
  }
}
