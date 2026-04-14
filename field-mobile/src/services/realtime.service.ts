import { supabase } from '../config/supabase';
import { pullIncidents, pullIncidentDetail } from './pull.service';

// Simple event bus
class EventBus {
  private listeners: Record<string, Set<() => void>> = {};

  on(event: string, callback: () => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);
  }

  off(event: string, callback: () => void) {
    this.listeners[event]?.delete(callback);
  }

  emit(event: string) {
    this.listeners[event]?.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Event listener error:', err);
      }
    });
  }
}

export const realtimeEvents = new EventBus();

// Supabase realtime channels
const channels: any[] = [];
let isSubscribed = false;

/**
 * Start realtime subscriptions for live data sync from Supabase
 */
export function startRealtimeSubscriptions(): void {
  if (isSubscribed) {
    console.log('Realtime subscriptions already active');
    return;
  }

  console.log('Starting Supabase realtime subscriptions...');
  isSubscribed = true;

  // Helper to handle any table change
  const handleChange = async (table: string, payload: any) => {
    console.log(`Realtime ${table} event:`, payload.eventType);

    try {
      if (table === 'incidents') {
        await pullIncidents();
        realtimeEvents.emit('incidents:changed');
        return;
      }

      // For other tables, extract incident_id and pull that incident
      let incidentId: string | null = null;

      if (table === 'patients') {
        incidentId = payload.new?.incident_id || payload.old?.incident_id;
      } else if (table === 'vitals') {
        // Vitals don't have incident_id directly, skip targeted pull
        // Instead just emit a general reload and let screens handle it
        realtimeEvents.emit('incidents:changed');
        return;
      } else if (table === 'interventions') {
        // Interventions don't have incident_id directly
        realtimeEvents.emit('incidents:changed');
        return;
      } else if (table === 'photos') {
        incidentId = payload.new?.incident_id || payload.old?.incident_id;
      }

      if (incidentId) {
        await pullIncidentDetail(incidentId);
        realtimeEvents.emit(`incident:${incidentId}:changed`);
        realtimeEvents.emit('incidents:changed');
      } else {
        // Fallback: pull all incidents
        await pullIncidents();
        realtimeEvents.emit('incidents:changed');
      }
    } catch (err: any) {
      console.error('Realtime pull failed:', err.message);
    }
  };

  // Subscribe to incidents
  const incidentsChannel = supabase
    .channel('incidents-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'incidents' },
      (payload) => handleChange('incidents', payload)
    )
    .subscribe();
  channels.push(incidentsChannel);

  // Subscribe to patients
  const patientsChannel = supabase
    .channel('patients-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patients' },
      (payload) => handleChange('patients', payload)
    )
    .subscribe();
  channels.push(patientsChannel);

  // Subscribe to vitals
  const vitalsChannel = supabase
    .channel('vitals-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vitals' },
      (payload) => handleChange('vitals', payload)
    )
    .subscribe();
  channels.push(vitalsChannel);

  // Subscribe to interventions
  const interventionsChannel = supabase
    .channel('interventions-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'interventions' },
      (payload) => handleChange('interventions', payload)
    )
    .subscribe();
  channels.push(interventionsChannel);

  // Subscribe to photos
  const photosChannel = supabase
    .channel('photos-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'photos' },
      (payload) => handleChange('photos', payload)
    )
    .subscribe();
  channels.push(photosChannel);
}

/**
 * Stop all realtime subscriptions
 */
export function stopRealtimeSubscriptions(): void {
  console.log('Stopping realtime subscriptions...');
  channels.forEach((channel) => {
    try {
      supabase.removeChannel(channel);
    } catch (err) {
      console.error('Error removing channel:', err);
    }
  });
  channels.length = 0;
  isSubscribed = false;
}

/**
 * Check if realtime is active
 */
export function isRealtimeActive(): boolean {
  return isSubscribed;
}
