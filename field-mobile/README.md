# EMS Field Mobile App

React Native mobile application for EMS field responders with offline-first architecture.

## Features

- **Offline-First**: Works without network, syncs when connected
- **Incident Logging**: Create and manage incidents on scene
- **Patient Tracking**: Triage, vitals, and interventions
- **Real-time Sync**: WebSocket integration for live updates
- **Secure Auth**: Supabase JWT authentication

## Tech Stack

- React Native (Expo SDK 50)
- TypeScript
- SQLite (expo-sqlite) for local storage
- Zustand for state management
- React Navigation
- Supabase Auth

## Setup

### 1. Install Dependencies

```bash
cd field-mobile
npm install
```

### 2. Configure Environment

Create `.env` file in `field-mobile/`:

```env
SUPABASE_URL=https://ihavznutnicyvqhokuuh.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_W0-y1MAdK7AwJkzwvtnYIw_MJezEszT
API_BASE_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
# Start Expo
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Architecture

### Offline-First Data Flow

1. **Local SQLite**: All data stored locally first
2. **Sync Queue**: Mutations queued for server sync
3. **Optimistic UI**: Immediate local updates, background sync
4. **Conflict Resolution**: Last-write-wins with server timestamp

### Database Schema

**Local Tables:**
- `incidents` - Incident records with sync status
- `patients` - Patient records linked to incidents
- `vitals` - Vital signs recordings
- `interventions` - Medical interventions/procedures
- `sync_queue` - Pending operations for sync

### Sync Strategy

- **Triggers**: App foreground, network online, pull-to-refresh
- **Retry**: Exponential backoff for failed operations
- **Priority**: Status updates sync before other changes
- **Deduplication**: Unique operation IDs prevent duplicates

## Screens

| Screen | Purpose |
|--------|---------|
| Login | Supabase authentication |
| Home | Active cases + recent incidents |
| New Incident | Create incident with triage counts |
| Incident Detail | View case, status timeline, patients |
| New Patient | Add patient with triage/observations |
| Patient Detail | View patient, interventions, add logs |

## File Structure

```
src/
├── config/          # Supabase, API config
├── database/        # SQLite operations
├── services/        # Sync, auth, realtime
├── stores/          # Zustand stores
├── navigation/      # React Navigation
├── screens/         # UI screens
└── types/           # TypeScript types
```

## API Integration

Communicates with NestJS backend:
- `POST /incidents` - Create incident
- `POST /patients` - Add patient
- `GET /incidents/active` - Active cases
- WebSocket for real-time updates

## Testing

```bash
# Type check
npm run ts:check

# Run tests
npm test
```

## Building for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```
