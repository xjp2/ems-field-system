import { querySql, getOne, executeSql } from './db-connection';
import { Patient } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all patients for an incident
 */
export async function getPatientsByIncident(incidentId: string): Promise<Patient[]> {
  const results = await querySql<Patient>(
    `SELECT * FROM patients WHERE incident_id = ? ORDER BY created_at ASC`,
    [incidentId]
  );
  return results.map(row => ({
    ...row,
    is_synced: Boolean(row.is_synced),
    observations: row.observations ? JSON.parse(row.observations) : [],
  }));
}

/**
 * Get single patient by ID
 */
export async function getPatientById(id: string): Promise<Patient | null> {
  const result = await getOne<Patient & { observations: string }>(
    `SELECT * FROM patients WHERE id = ?`,
    [id]
  );
  if (result) {
    return {
      ...result,
      is_synced: Boolean(result.is_synced),
      observations: result.observations ? JSON.parse(result.observations) : [],
    };
  }
  return null;
}

/**
 * Create new patient
 */
export async function createPatient(
  patient: Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'is_synced'>
): Promise<Patient> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const newPatient: Patient = {
    ...patient,
    id,
    created_at: now,
    updated_at: now,
    is_synced: false,
  };
  
  await executeSql(
    `INSERT INTO patients (
      id, server_id, incident_id, server_incident_id, first_name, last_name,
      date_of_birth, gender, mrn, emergency_contact_name, emergency_contact_phone,
      chief_complaint, medical_history, triage_priority, observations, triaged_at,
      created_at, updated_at, created_by, updated_by, is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newPatient.id,
      newPatient.server_id || null,
      newPatient.incident_id,
      newPatient.server_incident_id || null,
      newPatient.first_name || null,
      newPatient.last_name || null,
      newPatient.date_of_birth || null,
      newPatient.gender || null,
      newPatient.mrn || null,
      newPatient.emergency_contact_name || null,
      newPatient.emergency_contact_phone || null,
      newPatient.chief_complaint || null,
      newPatient.medical_history || null,
      newPatient.triage_priority,
      JSON.stringify(newPatient.observations || []),
      newPatient.triaged_at || null,
      newPatient.created_at,
      newPatient.updated_at,
      newPatient.created_by || null,
      newPatient.updated_by || null,
      0,
    ]
  );
  
  return newPatient;
}

/**
 * Update patient
 */
export async function updatePatient(
  id: string,
  updates: Partial<Patient>
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at') {
      if (key === 'observations') {
        sets.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }
  });
  
  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  
  sets.push('is_synced = ?');
  values.push(0);
  
  values.push(id);
  
  await executeSql(
    `UPDATE patients SET ${sets.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Mark patient as synced
 */
export async function markPatientSynced(
  localId: string,
  serverId: string,
  serverIncidentId?: string
): Promise<void> {
  if (serverIncidentId) {
    await executeSql(
      `UPDATE patients SET server_id = ?, server_incident_id = ?, is_synced = 1 WHERE id = ?`,
      [serverId, serverIncidentId, localId]
    );
  } else {
    await executeSql(
      `UPDATE patients SET server_id = ?, is_synced = 1 WHERE id = ?`,
      [serverId, localId]
    );
  }
}

/**
 * Get unsynced patients
 */
export async function getUnsyncedPatients(): Promise<Patient[]> {
  const results = await querySql<Patient & { observations: string }>(
    `SELECT * FROM patients WHERE is_synced = 0 ORDER BY created_at ASC`
  );
  return results.map(row => ({
    ...row,
    is_synced: false,
    observations: row.observations ? JSON.parse(row.observations) : [],
  }));
}

/**
 * Delete patient
 */
export async function deletePatient(id: string): Promise<void> {
  await executeSql(`DELETE FROM patients WHERE id = ?`, [id]);
}

/**
 * Get patient count for an incident
 */
export async function getPatientCountByIncident(incidentId: string): Promise<number> {
  const result = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM patients WHERE incident_id = ?`,
    [incidentId]
  );
  return result?.count || 0;
}

/**
 * Get triage counts for an incident
 */
export async function getTriageCounts(incidentId: string): Promise<{
  red: number;
  yellow: number;
  green: number;
  black: number;
}> {
  const results = await querySql<{ triage_priority: string; count: number }>(
    `SELECT triage_priority, COUNT(*) as count 
     FROM patients 
     WHERE incident_id = ? 
     GROUP BY triage_priority`,
    [incidentId]
  );
  
  const counts = { red: 0, yellow: 0, green: 0, black: 0 };
  results.forEach(row => {
    if (row.triage_priority in counts) {
      counts[row.triage_priority as keyof typeof counts] = row.count;
    }
  });
  return counts;
}

/**
 * Get patient by server_id
 */
export async function getPatientByServerId(serverId: string): Promise<Patient | null> {
  const result = await getOne<Patient & { observations: string }>(
    `SELECT * FROM patients WHERE server_id = ?`,
    [serverId]
  );
  if (result) {
    return {
      ...result,
      is_synced: Boolean(result.is_synced),
      observations: result.observations ? JSON.parse(result.observations) : [],
    };
  }
  return null;
}

/**
 * Get server_id for a local patient
 */
export async function getPatientServerId(localId: string): Promise<string | null> {
  const result = await getOne<{ server_id: string }>(
    `SELECT server_id FROM patients WHERE id = ?`,
    [localId]
  );
  return result?.server_id || null;
}
