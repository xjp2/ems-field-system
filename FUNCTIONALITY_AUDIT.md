# EMS Field Mobile - Functionality Audit

## ✅ Working
1. **Authentication** - Login with Supabase
2. **Create Incident** - Saves to SQLite, syncs to server
3. **Create Patient** - Saves to SQLite, syncs to server
4. **Sync Engine** - Auto-sync, retry logic, dependency ordering

## ❌ Missing / Broken

### 1. Add Vital Signs Screen
**Status:** Not implemented
**What it needs:**
- Screen to input vital signs (BP, HR, RR, O2 sat, temp, GCS)
- Save to SQLite `vitals` table
- Add to sync queue
- Map `patient_id` (local) → `server_patient_id` before sync

### 2. Add Intervention Screen
**Status:** Not implemented
**What it needs:**
- Screen to log interventions (meds, procedures)
- Save to SQLite `interventions` table
- Add to sync queue
- Map `patient_id` (local) → `server_patient_id` before sync

### 3. View Vitals History
**Status:** Mock data only
**Current:** `PatientDetailScreen` shows `MOCK_INTERVENTIONS`
**Fix:** Load real data from SQLite

### 4. Vitals/Interventions Sync
**Status:** Partial - sync functions exist but missing server_id mapping
**Issue:** 
- `syncVital` sends local `patient_id` but server needs server patient ID
- Same for `syncIntervention`
**Fix:** Look up `server_patient_id` before sending

### 5. Incident Detail Screen
**Status:** Shows patients but no vitals/interventions
**What it needs:**
- List of patients with triage colors
- Tap patient → PatientDetail
- Maybe show patient count/vitals summary

### 6. Real-time Updates
**Status:** WebSocket exists but not integrated in mobile
**What it needs:**
- Subscribe to incident updates
- Refresh UI when server data changes

### 7. Offline Indicators
**Status:** ConnectionStatus component exists but not comprehensive
**What it needs:**
- Show sync status per record
- Show "pending sync" badges
- Show last sync time

## 🔧 Priority Fix Order

### P0 - Critical (Data Loss Risk)
1. Fix vitals/interventions sync (server_id mapping)
2. Add server_patient_id lookup functions

### P1 - Essential Functionality
3. Create AddVitalScreen
4. Create AddInterventionScreen
5. Fix PatientDetail to show real data

### P2 - Nice to Have
6. Real-time subscriptions
7. Better offline indicators
8. Pull-to-refresh on all lists

## Implementation Plan

### Phase 1: Fix Sync (Now)
- Add `getPatientServerId()` function
- Update `syncVital` to map patient_id
- Update `syncIntervention` to map patient_id
- Add sync for vitals/interventions in queue processing

### Phase 2: Add Screens
- AddVitalScreen with form
- AddInterventionScreen with form
- Update navigation
- Add auto-sync on save

### Phase 3: Polish
- Fix PatientDetail to load real data
- Add real-time updates
- Improve offline UX

---

Ready to start with Phase 1?
