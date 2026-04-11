import { querySql, getOne, executeSql } from './db-connection';
import { Intervention } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all interventions for a patient
 */
export async function getInterventionsByPatient(patientId: string): Promise<Intervention[]> {
  const results = await querySql<Intervention>(
    `SELECT * FROM interventions WHERE patient_id = ? ORDER BY performed_at DESC`,
    [patientId]
  );
  return results.map(row => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}

/**
 * Get single intervention by ID
 */
export async function getInterventionById(id: string): Promise<Intervention | null> {
  const result = await getOne<Intervention>(
    `SELECT * FROM interventions WHERE id = ?`,
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
 * Create new intervention
 */
export async function createIntervention(
  intervention: Omit<Intervention, 'id' | 'created_at' | 'is_synced'>
): Promise<Intervention> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const newIntervention: Intervention = {
    ...intervention,
    id,
    created_at: now,
    is_synced: false,
  };
  
  await executeSql(
    `INSERT INTO interventions (
      id, server_id, patient_id, server_patient_id, performed_at,
      type, name, dosage, route, indication, response, notes,
      created_at, created_by, is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newIntervention.id,
      newIntervention.server_id || null,
      newIntervention.patient_id,
      newIntervention.server_patient_id || null,
      newIntervention.performed_at,
      newIntervention.type,
      newIntervention.name,
      newIntervention.dosage || null,
      newIntervention.route || null,
      newIntervention.indication || null,
      newIntervention.response || null,
      newIntervention.notes || null,
      newIntervention.created_at,
      newIntervention.created_by || null,
      0,
    ]
  );
  
  return newIntervention;
}

/**
 * Mark intervention as synced
 */
export async function markInterventionSynced(
  localId: string,
  serverId: string
): Promise<void> {
  await executeSql(
    `UPDATE interventions SET server_id = ?, is_synced = 1 WHERE id = ?`,
    [serverId, localId]
  );
}

/**
 * Get unsynced interventions
 */
export async function getUnsyncedInterventions(): Promise<Intervention[]> {
  const results = await querySql<Intervention>(
    `SELECT * FROM interventions WHERE is_synced = 0 ORDER BY created_at ASC`
  );
  return results.map(row => ({
    ...row,
    is_synced: false,
  }));
}

/**
 * Delete intervention
 */
export async function deleteIntervention(id: string): Promise<void> {
  await executeSql(`DELETE FROM interventions WHERE id = ?`, [id]);
}

/**
 * Get interventions by type for a patient
 */
export async function getInterventionsByType(
  patientId: string,
  type: string
): Promise<Intervention[]> {
  const results = await querySql<Intervention>(
    `SELECT * FROM interventions WHERE patient_id = ? AND type = ? ORDER BY performed_at DESC`,
    [patientId, type]
  );
  return results.map(row => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}
