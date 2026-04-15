import { Injectable, NotFoundException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseConfig, Incident, IncidentStatus } from '../config/supabase.config';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class IncidentsService {
  constructor(
    private supabaseConfig: SupabaseConfig,
    private realtimeService: RealtimeService,
  ) {}

  /**
   * Create a new incident
   * Automatically sets created_by and timestamps status changes
   */
  async create(user: AuthenticatedUser, dto: CreateIncidentDto): Promise<Incident> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    // Build the insert data with status timestamps
    const insertData: any = {
      ...dto,
      created_by: user.id,
      updated_by: user.id,
    };

    // Set status timestamp based on status
    if (dto.status) {
      insertData[this.getStatusTimestampField(dto.status)] = new Date().toISOString();
    }

    const { data, error } = await client
      .from('incidents')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', JSON.stringify(error));
      console.error('Insert data:', JSON.stringify(insertData));
      throw new HttpException(
        `Failed to create incident: ${error.message} (code: ${(error as any).code || 'unknown'}, details: ${(error as any).details || 'none'}, hint: ${(error as any).hint || 'none'})`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const incident = data as Incident;

    // Broadcast the new incident (non-blocking - don't fail if realtime is down)
    try {
      this.realtimeService.broadcastIncidentCreated(incident);
    } catch (broadcastErr: any) {
      console.error('Failed to broadcast incident created:', broadcastErr.message);
    }

    return incident;
  }

  /**
   * Get all incidents for the current user
   * RLS automatically filters based on user's role
   */
  async findAll(user: AuthenticatedUser): Promise<Incident[]> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch incidents: ${error.message}`);
    }

    return (data || []) as Incident[];
  }

  /**
   * Get active incidents (not closed or cancelled)
   * COMMAND users see all active incidents
   * FIELD users see only their own
   */
  async findActive(user: AuthenticatedUser): Promise<Incident[]> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('incidents')
      .select('*')
      .not('status', 'in', '(closed,cancelled)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch active incidents: ${error.message}`);
    }

    return (data || []) as Incident[];
  }

  /**
   * Get a single incident by ID
   */
  async findOne(user: AuthenticatedUser, id: string): Promise<Incident> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client
      .from('incidents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Incident not found');
    }

    return data as Incident;
  }

  /**
   * Update an incident
   */
  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateIncidentDto,
  ): Promise<Incident> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    // Build update data
    const updateData: any = {
      ...dto,
      updated_by: user.id,
    };

    // Set status timestamp if status changed
    if (dto.status) {
      updateData[this.getStatusTimestampField(dto.status)] = new Date().toISOString();
    }

    const { data, error } = await client
      .from('incidents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Incident not found or update failed');
    }

    const incident = data as Incident;

    // Broadcast the update (non-blocking)
    try {
      this.realtimeService.broadcastIncidentUpdated(incident);
    } catch (broadcastErr: any) {
      console.error('Failed to broadcast incident updated:', broadcastErr.message);
    }

    return incident;
  }

  /**
   * Get incident with patients and their latest vitals
   * Uses the secure database function
   */
  async findWithPatients(user: AuthenticatedUser, id: string): Promise<any> {
    const client = this.supabaseConfig.getClientForUser(user.jwt);

    const { data, error } = await client.rpc('get_incident_with_patients', {
      p_incident_id: id,
    });

    if (error) {
      throw new Error(`Failed to fetch incident details: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new NotFoundException('Incident not found');
    }

    return data[0];
  }

  /**
   * Helper to get the timestamp field for a status
   */
  private getStatusTimestampField(status: IncidentStatus): string {
    const statusToField: Record<IncidentStatus, string> = {
      draft: 'created_at',
      dispatched: 'dispatched_at',
      en_route: 'en_route_at',
      on_scene: 'on_scene_at',
      transporting: 'transporting_at',
      arrived: 'arrived_at',
      closed: 'closed_at',
      cancelled: 'closed_at',
    };
    return statusToField[status] || 'updated_at';
  }
}
