import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Service for broadcasting real-time events
 * Injected into other services to emit WebSocket events
 */
@Injectable()
export class RealtimeService {
  constructor(private realtimeGateway: RealtimeGateway) {}

  /**
   * Broadcast when a new incident is created
   */
  broadcastIncidentCreated(incident: any): void {
    this.realtimeGateway.broadcastIncidentCreated(incident);
  }

  /**
   * Broadcast when an incident is updated
   */
  broadcastIncidentUpdated(incident: any): void {
    this.realtimeGateway.broadcastIncidentUpdated(incident);
  }

  /**
   * Broadcast when a patient is added to an incident
   */
  broadcastPatientAdded(incidentId: string, patient: any): void {
    this.realtimeGateway.broadcastPatientAdded(incidentId, patient);
  }

  /**
   * Broadcast when vitals are added to a patient
   */
  broadcastVitalsAdded(incidentId: string, patientId: string, vital: any): void {
    this.realtimeGateway.broadcastVitalsAdded(incidentId, patientId, vital);
  }

  /**
   * Broadcast when an intervention is added to a patient
   */
  broadcastInterventionAdded(incidentId: string, patientId: string, intervention: any): void {
    this.realtimeGateway.broadcastInterventionAdded(incidentId, patientId, intervention);
  }
}
