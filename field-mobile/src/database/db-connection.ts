import * as SQLite from 'expo-sqlite';

// Database name
const DB_NAME = 'ems_field.db';

// Singleton database instance
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get or create database connection
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Execute SQL with automatic database handling
 */
export async function executeSql(
  sql: string,
  params: any[] = []
): Promise<SQLite.SQLiteRunResult> {
  const database = await getDatabase();
  return database.runAsync(sql, params);
}

/**
 * Query SQL with automatic database handling
 */
export async function querySql<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const database = await getDatabase();
  const result = await database.getAllAsync<T>(sql, params);
  return result || [];
}

/**
 * Get single row
 */
export async function getOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<T>(sql, params);
  return result || null;
}

/**
 * Transaction wrapper
 */
export async function transaction<T>(
  callback: (tx: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const database = await getDatabase();
  return database.withTransactionAsync(async () => {
    return callback(database);
  });
}
