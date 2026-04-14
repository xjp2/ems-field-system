import { getDatabase } from './db-connection';

/**
 * Initialize database schema
 * Creates all tables if they don't exist
 */
export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();
  
  await db.withTransactionAsync(async () => {
    // Incidents table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT,
        incident_number TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        location_description TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        priority TEXT,
        chief_complaint TEXT,
        scene_description TEXT,
        estimated_arrival TEXT,
        dispatched_at TEXT,
        en_route_at TEXT,
        on_scene_at TEXT,
        transporting_at TEXT,
        arrived_at TEXT,
        closed_at TEXT,
        local_id TEXT,
        device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        is_synced INTEGER DEFAULT 0,
        sync_error TEXT,
        pending_changes TEXT
      )
    `);

    // Patients table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT,
        incident_id TEXT NOT NULL,
        server_incident_id TEXT,
        first_name TEXT,
        last_name TEXT,
        date_of_birth TEXT,
        gender TEXT,
        mrn TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        chief_complaint TEXT,
        medical_history TEXT,
        triage_priority TEXT NOT NULL DEFAULT 'green',
        observations TEXT,
        triaged_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        is_synced INTEGER DEFAULT 0,
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      )
    `);

    // Vitals table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS vitals (
        id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT,
        patient_id TEXT NOT NULL,
        server_patient_id TEXT,
        recorded_at TEXT NOT NULL,
        blood_pressure_systolic INTEGER,
        blood_pressure_diastolic INTEGER,
        heart_rate INTEGER,
        respiratory_rate INTEGER,
        oxygen_saturation REAL,
        temperature REAL,
        blood_glucose INTEGER,
        gcs_total INTEGER,
        gcs_eye INTEGER,
        gcs_verbal INTEGER,
        gcs_motor INTEGER,
        pain_score INTEGER,
        etco2 INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT,
        is_synced INTEGER DEFAULT 0,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      )
    `);

    // Interventions table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS interventions (
        id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT,
        patient_id TEXT NOT NULL,
        server_patient_id TEXT,
        performed_at TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other',
        name TEXT NOT NULL,
        dosage TEXT,
        route TEXT,
        indication TEXT,
        response TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT,
        is_synced INTEGER DEFAULT 0,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
      )
    `);

    // Sync queue table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        table_name TEXT NOT NULL,
        local_id TEXT NOT NULL,
        server_id TEXT,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        priority INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    // Photos table
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY NOT NULL,
        server_id TEXT,
        incident_id TEXT NOT NULL,
        server_incident_id TEXT,
        uri TEXT NOT NULL,
        caption TEXT,
        taken_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_incidents_sync ON incidents(is_synced)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_patients_incident ON patients(incident_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_interventions_patient ON interventions(patient_id)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(retry_count)`);
    await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_photos_incident ON photos(incident_id)`);

    // Run migrations for schema updates
    await runMigrations(db);
  });

  console.log('Database initialized successfully');
}

async function runMigrations(db: any): Promise<void> {
  // Migration: Add hospital_id to incidents if missing
  try {
    await db.runAsync(`ALTER TABLE incidents ADD COLUMN hospital_id TEXT`);
    console.log('Migration applied: Added hospital_id to incidents');
  } catch (err: any) {
    if (!err.message?.includes('duplicate column')) {
      console.log('Migration note: hospital_id column already exists or other error:', err.message);
    }
  }
}

/**
 * Drop all tables - USE WITH CAUTION
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  
  await db.withTransactionAsync(async () => {
    await db.runAsync('DROP TABLE IF EXISTS interventions');
    await db.runAsync('DROP TABLE IF EXISTS vitals');
    await db.runAsync('DROP TABLE IF EXISTS patients');
    await db.runAsync('DROP TABLE IF EXISTS photos');
    await db.runAsync('DROP TABLE IF EXISTS incidents');
    await db.runAsync('DROP TABLE IF EXISTS sync_queue');
  });
  
  // Re-initialize
  await initializeDatabase();
}
