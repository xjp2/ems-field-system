import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';

/**
 * WebSocket Gateway for real-time incident updates
 * 
 * Events:
 * - Client -> Server:
 *   - 'join:hospital' - Subscribe to all hospital incidents
 *   - 'join:incident' - Subscribe to specific incident updates
 *   - 'leave:incident' - Unsubscribe from incident
 * 
 * - Server -> Client:
 *   - 'incident:created' - New incident created
 *   - 'incident:updated' - Incident fields/status changed
 *   - 'patient:added' - New patient added to incident
 *   - 'vitals:added' - New vitals recorded
 *   - 'intervention:added' - New intervention recorded
 */
@WebSocketGateway({
  cors: {
    origin: '*', // Configure properly in production
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('RealtimeGateway');

  constructor(private configService: ConfigService) {}

  /**
   * Handle client connection
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client joins hospital room to receive all incident updates
   */
  @SubscribeMessage('join:hospital')
  handleJoinHospital(
    @MessageBody() hospitalId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `hospital:${hospitalId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  /**
   * Client leaves hospital room
   */
  @SubscribeMessage('leave:hospital')
  handleLeaveHospital(
    @MessageBody() hospitalId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `hospital:${hospitalId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
    return { status: 'left', room };
  }

  /**
   * Client joins specific incident room for detailed updates
   */
  @SubscribeMessage('join:incident')
  handleJoinIncident(
    @MessageBody() incidentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `incident:${incidentId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
    return { status: 'joined', room };
  }

  /**
   * Client leaves incident room
   */
  @SubscribeMessage('leave:incident')
  handleLeaveIncident(
    @MessageBody() incidentId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const room = `incident:${incidentId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
    return { status: 'left', room };
  }

  /**
   * Broadcast incident created event
   */
  broadcastIncidentCreated(incident: any) {
    const room = incident.hospital_id ? `hospital:${incident.hospital_id}` : 'hospital:default';
    this.server.to(room).emit('incident:created', incident);
    this.logger.debug(`Broadcast incident:created to ${room}`);
  }

  /**
   * Broadcast incident updated event
   */
  broadcastIncidentUpdated(incident: any) {
    const hospitalRoom = incident.hospital_id ? `hospital:${incident.hospital_id}` : 'hospital:default';
    const incidentRoom = `incident:${incident.id}`;
    
    // Broadcast to hospital room (Command dashboard)
    this.server.to(hospitalRoom).emit('incident:updated', incident);
    
    // Broadcast to incident-specific room (Field app viewing this incident)
    this.server.to(incidentRoom).emit('incident:updated', incident);
    
    this.logger.debug(`Broadcast incident:updated to ${hospitalRoom} and ${incidentRoom}`);
  }

  /**
   * Broadcast patient added event
   */
  broadcastPatientAdded(incidentId: string, patient: any) {
    const room = `incident:${incidentId}`;
    this.server.to(room).emit('patient:added', { incidentId, patient });
  }

  /**
   * Broadcast vitals added event
   */
  broadcastVitalsAdded(incidentId: string, patientId: string, vital: any) {
    const room = `incident:${incidentId}`;
    this.server.to(room).emit('vitals:added', { incidentId, patientId, vital });
  }

  /**
   * Broadcast intervention added event
   */
  broadcastInterventionAdded(incidentId: string, patientId: string, intervention: any) {
    const room = `incident:${incidentId}`;
    this.server.to(room).emit('intervention:added', { incidentId, patientId, intervention });
  }
}
