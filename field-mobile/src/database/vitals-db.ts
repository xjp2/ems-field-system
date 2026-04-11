import { querySql, getOne, executeSql } from './db-connection';
import { Vital } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all vitals for a patient
 */
export async function getVitalsByPatient(patientId: string): Promise<Vital[]> {
  const results = await querySql<Vital>(
    `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC`,
    [patientId]
  );
  return results.map(row => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}

/**
 * Get single vital by ID
 */
export async function getVitalById(id: string): Promise<Vital | null> {
  const result = await getOne<Vital>(
    `SELECT * FROM vitals WHERE id = ?`,
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
 * Create new vital
 */
export async function createVital(
  vital: Omit<Vital, 'id' | 'created_at' | 'is_synced'>
): Promise<Vital> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const newVital: Vital = {
    ...vital,
    id,
    created_at: now,
    is_synced: false,
  };
  
  await executeSql(
    `INSERT INTO vitals (
      id, server_id, patient_id, server_patient_id, recorded_at,
      blood_pressure_systolic, blood_pressure_diastolic, heart_rate,
      respiratory_rate, oxygen_saturation, temperature, blood_glucose,
      gcs_total, gcs_eye, gcs_verbal, gcs_motor, pain_score, etco2,
      notes, created_at, created_by, is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newVital.id,
      newVital.server_id || null,
      newVital.patient_id,
      newVital.server_patient_id || null,
      newVital.recorded_at,
      newVital.blood_pressure_systolic || null,
      newVital.blood_pressure_diastolic || null,
      newVital.heart_rate || null,
      newVital.respiratory_rate || null,
      newVital.oxygen_saturation || null,
      newVital.temperature || null,
      newVital.blood_glucose || null,
      newVital.gcs_total || null,
      newVital.gcs_eye || null,
      newVital.gcs_verbal || null,
      newVital.gcs_motor || null,
      newVital.pain_score || null,
      newVital.etco2 || null,
      newVital.notes || null,
      newVital.created_at,
      newVital.created_by || null,
      0,
    ]
  );
  
  return newVital;
}

/**
 * Mark vital as synced
 */
export async function markVitalSynced(
  localId: string,
  serverId: string
): Promise<void> {
  await executeSql(
    `UPDATE vitals SET server_id = ?, is_synced = 1 WHERE id = ?`,
    [serverId, localId]
  );
}

/**
 * Get unsynced vitals
 */
export async function getUnsyncedVitals(): Promise<Vital[]> {
  const results = await querySql<Vital>(
    `SELECT * FROM vitals WHERE is_synced = 0 ORDER BY created_at ASC`
  );
  return results.map(row => ({
    ...row,
    is_synced: false,
  }));
}

/**
 * Delete vital
 */
export async function deleteVital(id: string): Promise<void> {
  await executeSql(`DELETE FROM vitals WHERE id = ?`, [id]);
}

/**
 * Get latest vital for a patient
 */
export async function getLatestVital(patientId: string): Promise<Vital | null> {
  const result = await getOne<Vital>(
    `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [patientId]
  );
  if (result) {
    return {
      ...result,
      is_synced: Boolean(result.is_synced),
    };
  }
  return null;
}
