import { querySql, getOne, executeSql, transaction } from './db-connection';
import { Incident } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all incidents ordered by created_at desc
 */
export async function getAllIncidents(): Promise<Incident[]> {
  const results = await querySql<Incident>(
    `SELECT * FROM incidents WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return results.map(row => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}

/**
 * Get active incidents (not closed or cancelled)
 */
export async function getActiveIncidents(): Promise<Incident[]> {
  const results = await querySql<Incident>(
    `SELECT * FROM incidents 
     WHERE status NOT IN ('closed', 'cancelled') 
     AND deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return results.map(row => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}

/**
 * Get single incident by ID
 */
export async function getIncidentById(id: string): Promise<Incident | null> {
  const result = await getOne<Incident>(
    `SELECT * FROM incidents WHERE id = ?`,
    [id]
  );
  if (result) {
    return {
      ...result,
      is_synced: Boolean(result.is_synced),
    };
  }
  return null;
}

/**
 * Create new incident
 */
export async function createIncident(
  incident: Omit<Incident, 'id' | 'created_at' | 'updated_at' | 'is_synced'>
): Promise<Incident> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const newIncident: Incident = {
    ...incident,
    id,
    created_at: now,
    updated_at: now,
    is_synced: false,
  };
  
  await executeSql(
    `INSERT INTO incidents (
      id, server_id, incident_number, address, latitude, longitude,
      location_description, status, priority, chief_complaint, scene_description,
      estimated_arrival, dispatched_at, en_route_at, on_scene_at, transporting_at,
      arrived_at, closed_at, local_id, device_id, created_at, updated_at,
      created_by, updated_by, is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newIncident.id,
      newIncident.server_id || null,
      newIncident.incident_number,
      newIncident.address,
      newIncident.latitude || null,
      newIncident.longitude || null,
      newIncident.location_description || null,
      newIncident.status,
      newIncident.priority || null,
      newIncident.chief_complaint || null,
      newIncident.scene_description || null,
      newIncident.estimated_arrival || null,
      newIncident.dispatched_at || null,
      newIncident.en_route_at || null,
      newIncident.on_scene_at || null,
      newIncident.transporting_at || null,
      newIncident.arrived_at || null,
      newIncident.closed_at || null,
      newIncident.local_id || null,
      newIncident.device_id || null,
      newIncident.created_at,
      newIncident.updated_at,
      newIncident.created_by || null,
      newIncident.updated_by || null,
      0, // is_synced = false
    ]
  );
  
  return newIncident;
}

/**
 * Update incident
 */
export async function updateIncident(
  id: string,
  updates: Partial<Incident>
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at') {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  
  sets.push('is_synced = ?');
  values.push(0); // Mark as unsynced
  
  values.push(id);
  
  await executeSql(
    `UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Mark incident as synced
 */
export async function markIncidentSynced(
  localId: string,
  serverId: string
): Promise<void> {
  await executeSql(
    `UPDATE incidents SET server_id = ?, is_synced = 1, sync_error = NULL WHERE id = ?`,
    [serverId, localId]
  );
}

/**
 * Update incident server_id after creation
 */
export async function updateIncidentServerId(
  localId: string,
  serverId: string
): Promise<void> {
  await executeSql(
    `UPDATE incidents SET server_id = ?, is_synced = 1 WHERE id = ?`,
    [serverId, localId]
  );
}

/**
 * Get unsynced incidents
 */
export async function getUnsyncedIncidents(): Promise<Incident[]> {
  const results = await querySql<Incident>(
    `SELECT * FROM incidents WHERE is_synced = 0 ORDER BY created_at ASC`
  );
  return results.map(row => ({
    ...row,
    is_synced: false,
  }));
}

/**
 * Delete incident (soft delete)
 */
export async function softDeleteIncident(id: string): Promise<void> {
  await executeSql(
    `UPDATE incidents SET deleted_at = ?, is_synced = 0 WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

/**
 * Get incident count for stats
 */
export async function getIncidentCount(): Promise<number> {
  const result = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM incidents WHERE deleted_at IS NULL`
  );
  return result?.count || 0;
}

/**
 * Get server_id for a local incident
 */
export async function getIncidentServerId(localId: string): Promise<string | null> {
  const result = await getOne<{ server_id: string }>(
    `SELECT server_id FROM incidents WHERE id = ?`,
    [localId]
  );
  return result?.server_id || null;
}
