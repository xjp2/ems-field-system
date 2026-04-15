import NetInfo from '@react-native-community/netinfo';
import { api, endpoints } from '../config/api';
import { 
  getPendingSyncOperations, 
  completeSyncOperation, 
  markSyncError 
} from '../database/sync-queue';
import { 
  updateIncidentServerId, 
  markIncidentSynced,
  getIncidentServerId,
  getIncidentById,
} from '../database/incidents-db';
import { markPatientSynced, getPatientServerId } from '../database/patients-db';
import { markVitalSynced, getVitalById } from '../database/vitals-db';
import { markInterventionSynced } from '../database/interventions-db';
import { markPhotoAsSynced, getPhotoById, getPhotosByIncident, deletePhoto, createPhoto } from '../database/photos-db';
import { SyncResult, SyncQueueEntry } from '../types/database';

const MAX_RETRIES = 5;

/**
 * Main sync function - processes pending operations
 */
export async function syncWithServer(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    operations_completed: 0,
    operations_failed: 0,
    errors: [],
  };
  
  // Check network
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) {
    result.success = false;
    result.errors.push('No network connection');
    return result;
  }
  
  // Get pending operations
  const operations = await getPendingSyncOperations(MAX_RETRIES);
  
  if (operations.length === 0) {
    return result;
  }
  
  console.log(`Processing ${operations.length} sync operations...`);
  
  // Sort operations: incidents first, then patients, vitals, interventions, photos
  // This ensures parent records sync before children
  const sortedOperations = operations.sort((a, b) => {
    const order = { incidents: 0, patients: 1, vitals: 2, interventions: 3, photos: 4 };
    return (order[a.table_name as keyof typeof order] || 99) - 
           (order[b.table_name as keyof typeof order] || 99);
  });
  
  // Process each operation
  for (const operation of sortedOperations) {
    try {
      console.log(`Syncing: ${operation.table_name} ${operation.operation} ${operation.local_id}`);
      await processOperation(operation);
      result.operations_completed++;
      console.log(`✓ Synced: ${operation.table_name} ${operation.local_id}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      
      // Check if this is a "dependency not ready" error (incident not synced yet)
      if (errorMsg.includes('not yet synced to server')) {
        console.log(`⏳ Skipping ${operation.table_name} ${operation.local_id}: ${errorMsg}`);
        // Don't mark as error - it will retry next sync
        continue;
      }
      
      result.operations_failed++;
      console.error(`✗ Sync failed: ${operation.table_name} ${operation.local_id} - ${errorMsg}`);
      console.error('Full error:', error);
      result.errors.push(`${operation.table_name}:${operation.operation} - ${errorMsg}`);
      await markSyncError(operation.id, errorMsg);
    }
  }
  
  result.success = result.operations_failed === 0;
  return result;
}

/**
 * Process a single sync operation
 */
async function processOperation(operation: SyncQueueEntry): Promise<void> {
  const payload = JSON.parse(operation.payload);
  
  switch (operation.table_name) {
    case 'incidents':
      await syncIncident(operation, payload);
      break;
    case 'patients':
      await syncPatient(operation, payload);
      break;
    case 'vitals':
      await syncVital(operation, payload);
      break;
    case 'interventions':
      await syncIntervention(operation, payload);
      break;
    case 'photos':
      await syncPhoto(operation, payload);
      break;
    default:
      throw new Error(`Unknown table: ${operation.table_name}`);
  }
  
  // Mark as completed
  await completeSyncOperation(operation.id);
}

/**
 * Sync incident to server
 */
async function syncIncident(
  operation: SyncQueueEntry,
  payload: any
): Promise<void> {
  switch (operation.operation) {
    case 'CREATE':
      // Check if this incident was already synced (prevents duplicates on retry)
      const localIncident = await getIncidentById(operation.local_id);
      if (localIncident?.server_id) {
        console.log('Incident already has server_id, skipping duplicate create:', localIncident.server_id);
        return;
      }

      const { data: created } = await api.post(
        endpoints.incidents.create(),
        payload
      );
      await updateIncidentServerId(operation.local_id, created.id);
      break;
      
    case 'UPDATE':
      if (!operation.server_id) {
        throw new Error('Cannot update: no server_id');
      }
      await api.patch(endpoints.incidents.update(operation.server_id), payload);
      await markIncidentSynced(operation.local_id, operation.server_id);
      break;
      
    case 'DELETE':
      if (operation.server_id) {
        await api.delete(endpoints.incidents.get(operation.server_id));
      }
      break;
  }
}

/**
 * Sync patient to server
 */
async function syncPatient(
  operation: SyncQueueEntry,
  payload: any
): Promise<void> {
  console.log('Syncing patient:', { 
    local_id: operation.local_id, 
    incident_id: payload.incident_id,
    has_incident_id: !!payload.incident_id 
  });
  
  switch (operation.operation) {
    case 'CREATE':
      // Ensure incident_id is provided
      if (!payload.incident_id) {
        throw new Error('Patient sync failed: missing incident_id');
      }
      
      // Look up the server_id for the incident
      const serverIncidentId = await getIncidentServerId(payload.incident_id);
      if (!serverIncidentId) {
        throw new Error(`Incident ${payload.incident_id} not yet synced to server. Will retry after incident syncs.`);
      }
      
      // Replace local incident_id with server incident_id
      const patientPayload = {
        ...payload,
        incident_id: serverIncidentId,
      };
      
      console.log('Creating patient with server incident_id:', serverIncidentId);
      
      const { data: created } = await api.post(
        endpoints.patients.create(),
        patientPayload
      );
      console.log('Patient created on server:', { 
        server_id: created.id, 
        incident_id: created.incident_id 
      });
      await markPatientSynced(
        operation.local_id,
        created.id,
        created.incident_id
      );
      break;
      
    default:
      console.warn(`Patient operation ${operation.operation} not implemented`);
  }
}

/**
 * Sync vital to server
 */
async function syncVital(
  operation: SyncQueueEntry,
  payload: any
): Promise<void> {
  if (operation.operation === 'CREATE') {
    // Look up the server_id for the patient
    const serverPatientId = await getPatientServerId(payload.patient_id);
    if (!serverPatientId) {
      throw new Error(`Patient ${payload.patient_id} not yet synced to server. Will retry after patient syncs.`);
    }
    
    // Replace local patient_id with server patient_id
    const vitalPayload = {
      ...payload,
      patient_id: serverPatientId,
    };
    
    console.log('Creating vital with server patient_id:', serverPatientId);
    const { data: created } = await api.post(endpoints.vitals.create(), vitalPayload);
    
    // Mark as synced with server_id
    await markVitalSynced(operation.local_id, created.id);
  } else if (operation.operation === 'UPDATE') {
    // Get the server_id for this vital
    const vital = await getVitalById(operation.local_id);
    if (!vital?.server_id) {
      throw new Error(`Vital ${operation.local_id} not yet synced to server. Will retry after vital syncs.`);
    }
    
    // Look up the server_id for the patient
    const serverPatientId = await getPatientServerId(payload.patient_id);
    if (!serverPatientId) {
      throw new Error(`Patient ${payload.patient_id} not yet synced to server. Will retry after patient syncs.`);
    }
    
    // Replace local patient_id with server patient_id
    const vitalPayload = {
      ...payload,
      patient_id: serverPatientId,
    };
    
    console.log('Updating vital with server id:', vital.server_id);
    await api.patch(endpoints.vitals.update(vital.server_id), vitalPayload);
    
    // Mark as synced
    await markVitalSynced(operation.local_id, vital.server_id);
  }
}

/**
 * Sync intervention to server
 */
async function syncIntervention(
  operation: SyncQueueEntry,
  payload: any
): Promise<void> {
  if (operation.operation === 'CREATE') {
    // Look up the server_id for the patient
    const serverPatientId = await getPatientServerId(payload.patient_id);
    if (!serverPatientId) {
      throw new Error(`Patient ${payload.patient_id} not yet synced to server. Will retry after patient syncs.`);
    }
    
    // Replace local patient_id with server patient_id
    const interventionPayload = {
      ...payload,
      patient_id: serverPatientId,
    };
    
    console.log('Creating intervention with server patient_id:', serverPatientId);
    const { data: created } = await api.post(endpoints.interventions.create(), interventionPayload);
    
    // Mark as synced with server_id
    await markInterventionSynced(operation.local_id, created.id);
  }
}

/**
 * Sync photo to server
 */
async function syncPhoto(
  operation: SyncQueueEntry,
  payload: any
): Promise<void> {
  if (operation.operation === 'CREATE') {
    // Check if photo was already synced (has server_id) - prevents duplicates on retry
    const localPhoto = await getPhotoById(operation.local_id);
    if (localPhoto?.server_id) {
      console.log('Photo already has server_id, skipping duplicate upload:', localPhoto.server_id);
      return;
    }

    // Look up the server_id for the incident
    const serverIncidentId = await getIncidentServerId(payload.incident_id);
    if (!serverIncidentId) {
      throw new Error(`Incident ${payload.incident_id} not yet synced to server. Will retry after incident syncs.`);
    }
    
    // Replace local incident_id with server incident_id
    const photoPayload = {
      ...payload,
      incident_id: serverIncidentId,
    };
    
    console.log('Creating photo with server incident_id:', serverIncidentId);
    
    // For photos, we need to upload the file
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('incident_id', serverIncidentId);
    if (payload.caption) {
      formData.append('caption', payload.caption);
    }
    formData.append('taken_at', payload.taken_at);
    
    // Append the file - uri should be a local file path
    const uri = payload.uri;
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.([a-zA-Z]+)$/.exec(filename);
    const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
    
    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);
    
    const { data: created } = await api.post(endpoints.photos.create(), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: (data) => data,
    });
    
    // Mark as synced with server_id and update URI to public URL
    await markPhotoAsSynced(operation.local_id, created.id, created.public_url);
  }
}

/**
 * Reconcile local photos with server photos for an incident
 * Removes local photos deleted from server, adds server photos missing locally
 */
export async function reconcilePhotosForIncident(incidentId: string): Promise<void> {
  const serverIncidentId = await getIncidentServerId(incidentId);
  if (!serverIncidentId) {
    console.log('Incident not synced yet, skipping photo reconciliation');
    return;
  }
  
  try {
    // Fetch server photos
    const { data: serverPhotos } = await api.get(endpoints.photos.byIncident(serverIncidentId));
    const serverPhotoList = serverPhotos || [];
    const serverPhotoIds = new Set(serverPhotoList.map((p: any) => p.id));
    
    // Get local photos
    const localPhotos = await getPhotosByIncident(incidentId);
    const syncedLocalPhotos = localPhotos.filter(p => p.is_synced && p.server_id);
    
    // Delete local synced photos that no longer exist on server
    for (const localPhoto of syncedLocalPhotos) {
      if (!serverPhotoIds.has(localPhoto.server_id!)) {
        console.log('Deleting local photo removed from server:', localPhoto.id);
        await deletePhoto(localPhoto.id);
      }
    }
    
    // Add server photos that don't exist locally
    const localServerIds = new Set(localPhotos.map(p => p.server_id).filter(Boolean));
    for (const serverPhoto of serverPhotoList) {
      if (!localServerIds.has(serverPhoto.id)) {
        console.log('Adding server photo to local:', serverPhoto.id);
        await createPhoto({
          incident_id: incidentId,
          uri: serverPhoto.public_url,
          caption: serverPhoto.caption,
          taken_at: serverPhoto.taken_at,
          server_id: serverPhoto.id,
          server_incident_id: serverIncidentId,
          is_synced: true,
        });
      }
    }
  } catch (error: any) {
    console.error('Failed to reconcile photos:', error.message);
  }
}

/**
 * Check if there are pending sync operations
 */
export async function hasPendingSync(): Promise<boolean> {
  const operations = await getPendingSyncOperations(MAX_RETRIES);
  return operations.length > 0;
}

/**
 * Get sync status for UI
 */
export async function getSyncStatus(): Promise<{
  pending: number;
  isOnline: boolean;
}> {
  const [operations, netInfo] = await Promise.all([
    getPendingSyncOperations(MAX_RETRIES),
    NetInfo.fetch(),
  ]);
  
  return {
    pending: operations.length,
    isOnline: !!netInfo.isConnected,
  };
}
