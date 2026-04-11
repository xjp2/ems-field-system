import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig, Intervention, InterventionType } from '../config/supabase.config';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { RealtimeService } from '../realtime/realtime.service';

export interface CreateInterventionDto {
  patient_id: string;
  performed_at?: string;
  type: InterventionType;
  name: string;
  dosage?: string;
  route?: string;
  indication?: string;
  response?: string;
  notes?: string;
  local_id?: string;
}

@Injectable()
export class InterventionsService {
  constructor(
    private supabaseConfig: SupabaseConfig,
    private realtimeService: RealtimeService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateInterventionDto): Promise<Intervention> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('interventions')
      .insert({
        ...dto,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record intervention: ${error.message}`);
    }

    const intervention = data as Intervention;

    // Get incident_id for broadcasting
    const { data: patient } = await client
      .from('patients')
      .select('incident_id')
      .eq('id', dto.patient_id)
      .single();

    if (patient) {
      this.realtimeService.broadcastInterventionAdded(
        patient.incident_id,
        dto.patient_id,
        intervention,
      );
    }

    return intervention;
  }

  async findByPatient(user: AuthenticatedUser, patientId: string): Promise<Intervention[]> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('interventions')
      .select('*')
      .eq('patient_id', patientId)
      .order('performed_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch interventions: ${error.message}`);
    }

    return (data || []) as Intervention[];
  }

  async findOne(user: AuthenticatedUser, id: string): Promise<Intervention> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('interventions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Intervention not found');
    }

    return data as Intervention;
  }
}
