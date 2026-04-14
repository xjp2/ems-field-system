import { api, endpoints } from '../config/api';
import { Incident, Patient, Vital, Intervention, Photo } from '../types/database';
import { executeSql, getOne } from '../database/db-connection';
import { getIncidentById, getAllIncidents } from '../database/incidents-db';
import { getPhotosByIncident, createPhoto, deletePhoto } from '../database/photos-db';
import { realtimeEvents } from './realtime.service';

/**
 * Pull all incidents from server and upsert to local SQLite
 * Also deletes local synced incidents that no longer exist on server
 */
export async function pullIncidents(): Promise<void> {
  console.log('Pulling incidents from server...');
  const { data: incidents } = await api.get(endpoints.incidents.list());

  if (!Array.isArray(incidents)) {
    console.log('No incidents returned from server');
    return;
  }

  for (const serverIncident of incidents) {
    await upsertIncident(serverIncident);
  }

  // Delete local incidents that no longer exist on server
  const localIncidents = await getAllIncidents();
  const serverIncidentIds = new Set(incidents.map((inc: any) => inc.id));
  let deletedCount = 0;

  for (const localIncident of localIncidents) {
    // Check if this local incident exists on server by either local id or server_id
    const existsOnServer = serverIncidentIds.has(localIncident.id) ||
                           (localIncident.server_id && serverIncidentIds.has(localIncident.server_id));

    if (!existsOnServer) {
      console.log('Deleting local incident not found on server:', localIncident.id, 'server_id:', localIncident.server_id);
      await safeExecute(
        'DELETE FROM incidents WHERE id = ?',
        [localIncident.id]
      );
      deletedCount++;
    }
  }

  console.log(`Pulled ${incidents.length} incidents, deleted ${deletedCount} removed`);

  // Notify screens to reload if any changes were made
  if (deletedCount > 0) {
    realtimeEvents.emit('incidents:changed');
  }
}

/**
 * Pull a specific incident's full detail from server and upsert to local SQLite
 */
export async function pullIncidentDetail(incidentId: string): Promise<void> {
  console.log('Pulling incident detail from server:', incidentId);

  // Fetch incident
  const { data: serverIncident } = await api.get(endpoints.incidents.get(incidentId));
  if (!serverIncident) {
    console.log('Incident not found on server, deleting locally');
    await executeSql('DELETE FROM incidents WHERE id = ?', [incidentId]);
    return;
  }

  await upsertIncident(serverIncident);

  // Fetch patients for this incident
  const { data: patients } = await api.get(endpoints.patients.byIncident(incidentId));
  if (Array.isArray(patients)) {
    for (const patient of patients) {
      await upsertPatient(patient);

      // Fetch vitals for this patient
      try {
        const { data: vitals } = await api.get(endpoints.vitals.byPatient(patient.id));
        if (Array.isArray(vitals)) {
          for (const vital of vitals) {
            await upsertVital(vital);
          }
        }
      } catch (err) {
        console.log('No vitals for patient:', patient.id);
      }

      // Fetch interventions for this patient
      try {
        const { data: interventions } = await api.get(endpoints.interventions.byPatient(patient.id));
        if (Array.isArray(interventions)) {
          for (const intervention of interventions) {
            await upsertIntervention(intervention);
          }
        }
      } catch (err) {
        console.log('No interventions for patient:', patient.id);
      }
    }
  }

  // Fetch photos for this incident
  try {
    const { data: photos } = await api.get(endpoints.photos.byIncident(incidentId));
    if (Array.isArray(photos)) {
      // Get local synced photos
      const localPhotos = await getPhotosByIncident(incidentId);
      const syncedLocalPhotos = localPhotos.filter((p) => p.is_synced && p.server_id);
      const serverPhotoIds = new Set(photos.map((p: Photo) => p.id));

      // Delete local synced photos removed from server
      for (const localPhoto of syncedLocalPhotos) {
        if (!serverPhotoIds.has(localPhoto.server_id!)) {
          await deletePhoto(localPhoto.id);
        }
      }

      // Add/update server photos locally
      const localServerIds = new Set(localPhotos.map((p) => p.server_id).filter(Boolean));
      for (const photo of photos) {
        if (!localServerIds.has(photo.id)) {
          await createPhoto({
            incident_id: incidentId,
            uri: photo.public_url || '',
            caption: photo.caption,
            taken_at: photo.taken_at,
            created_at: photo.created_at,
            server_id: photo.id,
            server_incident_id: incidentId,
            is_synced: true,
          });
        }
      }
    }
  } catch (err: any) {
    console.log('No photos for incident:', incidentId, err?.message);
  }

  console.log('Pulled incident detail complete:', incidentId);
}

// --- Upsert Helpers ---

async function safeExecute(sql: string, params: any[]): Promise<void> {
  try {
    await executeSql(sql, params);
  } catch (err: any) {
    console.error('DB execute error:', err.message, 'SQL:', sql.slice(0, 100));
    throw err;
  }
}

async function upsertIncident(incident: any): Promise<void> {
  const existing = await getIncidentById(incident.id);

  if (existing) {
    // Don't overwrite local unsynced changes
    if (!existing.is_synced) {
      console.log('Skipping server incident update - local has unsynced changes:', incident.id);
      return;
    }

    await safeExecute(
      `UPDATE incidents SET
        server_id = ?, incident_number = ?, address = ?, latitude = ?, longitude = ?,
        location_description = ?, status = ?, priority = ?, chief_complaint = ?, scene_description = ?,
        estimated_arrival = ?, dispatched_at = ?, en_route_at = ?, on_scene_at = ?, transporting_at = ?,
        arrived_at = ?, closed_at = ?, local_id = ?, device_id = ?,
        created_at = ?, updated_at = ?, created_by = ?, updated_by = ?, is_synced = 1
      WHERE id = ?`,
      [
        incident.id,
        incident.incident_number,
        incident.address,
        incident.latitude || null,
        incident.longitude || null,
        incident.location_description || null,
        incident.status,
        incident.priority || null,
        incident.chief_complaint || null,
        incident.scene_description || null,
        incident.estimated_arrival || null,
        incident.dispatched_at || null,
        incident.en_route_at || null,
        incident.on_scene_at || null,
        incident.transporting_at || null,
        incident.arrived_at || null,
        incident.closed_at || null,
        incident.local_id || null,
        incident.device_id || null,
        incident.created_at,
        incident.updated_at,
        incident.created_by || null,
        incident.updated_by || null,
        incident.id,
      ]
    );
  } else {
    await safeExecute(
      `INSERT INTO incidents (
        id, server_id, incident_number, address, latitude, longitude,
        location_description, status, priority, chief_complaint, scene_description,
        estimated_arrival, dispatched_at, en_route_at, on_scene_at, transporting_at,
        arrived_at, closed_at, local_id, device_id,
        created_at, updated_at, created_by, updated_by, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident.id,
        incident.id, // server_id = id since it's from server
        incident.incident_number,
        incident.address,
        incident.latitude || null,
        incident.longitude || null,
        incident.location_description || null,
        incident.status,
        incident.priority || null,
        incident.chief_complaint || null,
        incident.scene_description || null,
        incident.estimated_arrival || null,
        incident.dispatched_at || null,
        incident.en_route_at || null,
        incident.on_scene_at || null,
        incident.transporting_at || null,
        incident.arrived_at || null,
        incident.closed_at || null,
        incident.local_id || null,
        incident.device_id || null,
        incident.created_at,
        incident.updated_at,
        incident.created_by || null,
        incident.updated_by || null,
        1, // is_synced = true
      ]
    );
  }
}

async function upsertPatient(patient: any): Promise<void> {
  const existing = await getOne<{ id: string; is_synced: number }>(
    'SELECT id, is_synced FROM patients WHERE id = ?',
    [patient.id]
  );

  if (existing && !existing.is_synced) {
    console.log('Skipping server patient update - local has unsynced changes:', patient.id);
    return;
  }

  const params = [
    patient.id,
    patient.id, // server_id
    patient.incident_id,
    patient.incident_id, // server_incident_id
    patient.first_name || null,
    patient.last_name || null,
    patient.date_of_birth || null,
    patient.gender || null,
    patient.mrn || null,
    patient.emergency_contact_name || null,
    patient.emergency_contact_phone || null,
    patient.chief_complaint || null,
    patient.medical_history || null,
    patient.priority || 'green',
    '[]', // observations
    patient.triaged_at || null,
    patient.local_id || null,
    patient.created_at,
    patient.updated_at,
    patient.created_by || null,
    patient.updated_by || null,
    1, // is_synced
  ];

  if (existing) {
    await safeExecute(
      `UPDATE patients SET
        server_id = ?, incident_id = ?, server_incident_id = ?, first_name = ?, last_name = ?,
        date_of_birth = ?, gender = ?, mrn = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
        chief_complaint = ?, medical_history = ?, priority = ?, observations = ?, triaged_at = ?,
        local_id = ?, created_at = ?, updated_at = ?, created_by = ?, updated_by = ?, is_synced = ?
      WHERE id = ?`,
      [...params, patient.id]
    );
  } else {
    await safeExecute(
      `INSERT INTO patients (
        id, server_id, incident_id, server_incident_id, first_name, last_name,
        date_of_birth, gender, mrn, emergency_contact_name, emergency_contact_phone,
        chief_complaint, medical_history, priority, observations, triaged_at,
        local_id, created_at, updated_at, created_by, updated_by, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
  }
}

async function upsertVital(vital: any): Promise<void> {
  const existing = await getOne<{ id: string; is_synced: number }>(
    'SELECT id, is_synced FROM vitals WHERE id = ?',
    [vital.id]
  );

  if (existing && !existing.is_synced) {
    console.log('Skipping server vital update - local has unsynced changes:', vital.id);
    return;
  }

  const params = [
    vital.id,
    vital.id, // server_id
    vital.patient_id,
    vital.patient_id, // server_patient_id
    vital.recorded_at,
    vital.blood_pressure_systolic || null,
    vital.blood_pressure_diastolic || null,
    vital.heart_rate || null,
    vital.respiratory_rate || null,
    vital.oxygen_saturation || null,
    vital.temperature || null,
    vital.blood_glucose || null,
    vital.gcs_total || null,
    vital.gcs_eye || null,
    vital.gcs_verbal || null,
    vital.gcs_motor || null,
    vital.pain_score || null,
    vital.etco2 || null,
    vital.notes || null,
    vital.local_id || null,
    vital.created_at,
    vital.created_by || null,
    1, // is_synced
  ];

  if (existing) {
    await safeExecute(
      `UPDATE vitals SET
        server_id = ?, patient_id = ?, server_patient_id = ?, recorded_at = ?, blood_pressure_systolic = ?,
        blood_pressure_diastolic = ?, heart_rate = ?, respiratory_rate = ?, oxygen_saturation = ?,
        temperature = ?, blood_glucose = ?, gcs_total = ?, gcs_eye = ?, gcs_verbal = ?, gcs_motor = ?,
        pain_score = ?, etco2 = ?, notes = ?, local_id = ?, created_at = ?, created_by = ?, is_synced = ?
      WHERE id = ?`,
      [...params, vital.id]
    );
  } else {
    await safeExecute(
      `INSERT INTO vitals (
        id, server_id, patient_id, server_patient_id, recorded_at, blood_pressure_systolic,
        blood_pressure_diastolic, heart_rate, respiratory_rate, oxygen_saturation,
        temperature, blood_glucose, gcs_total, gcs_eye, gcs_verbal, gcs_motor,
        pain_score, etco2, notes, local_id, created_at, created_by, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
  }
}

async function upsertIntervention(intervention: any): Promise<void> {
  const existing = await getOne<{ id: string; is_synced: number }>(
    'SELECT id, is_synced FROM interventions WHERE id = ?',
    [intervention.id]
  );

  if (existing && !existing.is_synced) {
    console.log('Skipping server intervention update - local has unsynced changes:', intervention.id);
    return;
  }

  const params = [
    intervention.id,
    intervention.id, // server_id
    intervention.patient_id,
    intervention.patient_id, // server_patient_id
    intervention.performed_at,
    intervention.type || 'other',
    intervention.name,
    intervention.dosage || null,
    intervention.route || null,
    intervention.indication || null,
    intervention.response || null,
    intervention.notes || null,
    intervention.local_id || null,
    intervention.created_at,
    intervention.created_by || null,
    1, // is_synced
  ];

  if (existing) {
    await safeExecute(
      `UPDATE interventions SET
        server_id = ?, patient_id = ?, server_patient_id = ?, performed_at = ?, type = ?,
        name = ?, dosage = ?, route = ?, indication = ?, response = ?, notes = ?,
        local_id = ?, created_at = ?, created_by = ?, is_synced = ?
      WHERE id = ?`,
      [...params, intervention.id]
    );
  } else {
    await safeExecute(
      `INSERT INTO interventions (
        id, server_id, patient_id, server_patient_id, performed_at, type,
        name, dosage, route, indication, response, notes,
        local_id, created_at, created_by, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
  }
}
