import { querySql, executeSql, getOne } from './db-connection';
import { SyncQueueEntry } from '../types/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Add operation to sync queue
 */
export async function addToSyncQueue(
  tableName: SyncQueueEntry['table_name'],
  localId: string,
  operation: SyncQueueEntry['operation'],
  payload: any,
  options?: {
    serverId?: string;
    priority?: number;
  }
): Promise<SyncQueueEntry> {
  const entry: SyncQueueEntry = {
    id: uuidv4(),
    table_name: tableName,
    local_id: localId,
    server_id: options?.serverId,
    operation,
    payload: JSON.stringify(payload),
    retry_count: 0,
    priority: options?.priority || 0,
    created_at: new Date().toISOString(),
  };
  
  await executeSql(
    `INSERT INTO sync_queue (
      id, table_name, local_id, server_id, operation, payload,
      retry_count, priority, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.table_name,
      entry.local_id,
      entry.server_id || null,
      entry.operation,
      entry.payload,
      entry.retry_count,
      entry.priority,
      entry.created_at,
    ]
  );
  
  return entry;
}

/**
 * Get pending sync operations
 */
export async function getPendingSyncOperations(
  maxRetries: number = 5
): Promise<SyncQueueEntry[]> {
  const results = await querySql<SyncQueueEntry>(
    `SELECT * FROM sync_queue 
     WHERE retry_count < ? 
     ORDER BY priority DESC, created_at ASC`,
    [maxRetries]
  );
  return results.map(row => ({
    ...row,
    payload: row.payload, // Keep as string, parse when needed
  }));
}

/**
 * Mark sync operation as completed (delete it)
 */
export async function completeSyncOperation(id: string): Promise<void> {
  await executeSql(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

/**
 * Increment retry count and set error
 */
export async function markSyncError(
  id: string,
  error: string
): Promise<void> {
  await executeSql(
    `UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`,
    [error, id]
  );
}

/**
 * Remove sync operation
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  await executeSql(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

/**
 * Get sync queue stats
 */
export async function getSyncQueueStats(): Promise<{
  total: number;
  pending: number;
  failed: number;
}> {
  const total = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue`
  );
  const pending = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE retry_count = 0`
  );
  const failed = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE retry_count > 0`
  );
  
  return {
    total: total?.count || 0,
    pending: pending?.count || 0,
    failed: failed?.count || 0,
  };
}

/**
 * Clear all completed/failed entries
 */
export async function clearSyncQueue(): Promise<void> {
  await executeSql(`DELETE FROM sync_queue`);
}

/**
 * Get pending count for UI badge
 */
export async function getPendingCount(): Promise<number> {
  const result = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < 5`
  );
  return result?.count || 0;
}
