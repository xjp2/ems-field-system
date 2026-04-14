import { Photo } from '../types/database';
import { getDatabase } from './db-connection';
import { v4 as uuidv4 } from 'uuid';

export async function createPhoto(photo: Omit<Photo, 'id' | 'created_at' | 'is_synced'> & { id?: string; created_at?: string; is_synced?: boolean }): Promise<Photo> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const photoRecord: Photo = {
    id: photo.id || uuidv4(),
    incident_id: photo.incident_id,
    uri: photo.uri,
    caption: photo.caption,
    taken_at: photo.taken_at || now,
    created_at: photo.created_at || now,
    is_synced: photo.is_synced ?? false,
    server_id: photo.server_id,
    server_incident_id: photo.server_incident_id,
  };
  
  await db.runAsync(
    `INSERT INTO photos (id, incident_id, uri, caption, taken_at, created_at, is_synced, server_id, server_incident_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      photoRecord.id,
      photoRecord.incident_id,
      photoRecord.uri,
      photoRecord.caption || null,
      photoRecord.taken_at,
      photoRecord.created_at,
      photoRecord.is_synced ? 1 : 0,
      photoRecord.server_id || null,
      photoRecord.server_incident_id || null,
    ]
  );
  
  return photoRecord;
}

export async function updatePhotoUri(photoId: string, uri: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE photos SET uri = ? WHERE id = ?`,
    [uri, photoId]
  );
}

export async function getPhotoById(photoId: string): Promise<Photo | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Photo>(
    `SELECT * FROM photos WHERE id = ?`,
    [photoId]
  );
  if (row) {
    return {
      ...row,
      is_synced: Boolean(row.is_synced),
    };
  }
  return null;
}

export async function getPhotosByIncident(incidentId: string): Promise<Photo[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Photo>(
    `SELECT * FROM photos WHERE incident_id = ? ORDER BY created_at ASC`,
    [incidentId]
  );
  return rows.map((row: Photo) => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}

export async function deletePhoto(photoId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM photos WHERE id = ?`, [photoId]);
}

export async function deletePhotosByIncident(incidentId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM photos WHERE incident_id = ?`, [incidentId]);
}

export async function markPhotoAsSynced(photoId: string, serverId: string, publicUrl?: string): Promise<void> {
  const db = await getDatabase();
  if (publicUrl) {
    await db.runAsync(
      `UPDATE photos SET is_synced = 1, server_id = ?, uri = ? WHERE id = ?`,
      [serverId, publicUrl, photoId]
    );
  } else {
    await db.runAsync(
      `UPDATE photos SET is_synced = 1, server_id = ? WHERE id = ?`,
      [serverId, photoId]
    );
  }
}

export async function getUnsyncedPhotos(incidentId?: string): Promise<Photo[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM photos WHERE is_synced = 0`;
  const params: string[] = [];
  
  if (incidentId) {
    query += ` AND incident_id = ?`;
    params.push(incidentId);
  }
  
  query += ` ORDER BY created_at ASC`;
  
  const rows = await db.getAllAsync<Photo>(query, params);
  return rows.map((row: Photo) => ({
    ...row,
    is_synced: Boolean(row.is_synced),
  }));
}
