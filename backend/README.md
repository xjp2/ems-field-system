# EMS Backend - NestJS API

Emergency Medical Response System backend built with NestJS, TypeScript, and Supabase.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NestJS Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Controllers │  │    Guards    │  │Realtime Gateway  │  │
│  │   (REST)     │  │ JWT + Roles  │  │   (WebSocket)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         └─────────────────┴────────────────────┘            │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Supabase Client (User JWT)                │   │
│  └─────────────────────────┬───────────────────────────┘   │
└────────────────────────────┼────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase PostgreSQL                        │
│  incidents │ patients │ vitals │ interventions │ RLS        │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
src/
├── main.ts                    # App bootstrap
├── app.module.ts              # Root module
├── config/
│   └── supabase.config.ts     # Supabase client + types
├── common/
│   ├── decorators/            # @CurrentUser, @Roles
│   └── guards/                # JwtAuthGuard, RolesGuard
├── auth/                      # Auth module (token validation)
├── users/                     # User profile management
├── incidents/                 # Incident CRUD + realtime
├── patients/                  # Patient management
├── vitals/                    # Vital signs recording
├── interventions/             # Medical interventions
└── realtime/                  # WebSocket gateway
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Required variables:
```env
SUPABASE_URL=https://ihavznutnicyvqhokuuh.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_JWT_SECRET=your-jwt-secret
```

Get `SUPABASE_JWT_SECRET` from Supabase Dashboard > Project Settings > API > JWT Settings.

### 3. Run Development Server

```bash
# Development with hot reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server will start on:
- HTTP API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs
- WebSocket: ws://localhost:3000/realtime

## API Endpoints

### Authentication
All endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <supabase_jwt_token>
```

### Incidents
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /incidents | FIELD | Create incident |
| GET | /incidents | Any | List user's incidents |
| GET | /incidents/active | COMMAND | All active incidents |
| GET | /incidents/:id | Any | Get incident |
| GET | /incidents/:id/detail | Any | Get with patients |
| PATCH | /incidents/:id | Any | Update incident |

### Patients
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /patients | FIELD | Add patient |
| GET | /patients/incident/:id | Any | Get by incident |
| GET | /patients/:id | Any | Get patient |

### Vitals
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /vitals | FIELD | Record vitals |
| GET | /vitals/patient/:id | Any | Get by patient |

### Interventions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /interventions | FIELD | Record intervention |
| GET | /interventions/patient/:id | Any | Get by patient |

## WebSocket Events

### Client → Server
```javascript
// Join hospital room (for Command dashboard)
socket.emit('join:hospital', hospitalId);

// Join specific incident (for Field app)
socket.emit('join:incident', incidentId);

// Leave rooms
socket.emit('leave:hospital', hospitalId);
socket.emit('leave:incident', incidentId);
```

### Server → Client
```javascript
// New incident created
socket.on('incident:created', (incident) => { ... });

// Incident updated (status, ETA, etc.)
socket.on('incident:updated', (incident) => { ... });

// Patient added to incident
socket.on('patient:added', ({ incidentId, patient }) => { ... });

// Vitals recorded
socket.on('vitals:added', ({ incidentId, patientId, vital }) => { ... });

// Intervention recorded
socket.on('intervention:added', ({ incidentId, patientId, intervention }) => { ... });
```

## Authentication Flow

1. **Mobile/Web App** authenticates with Supabase Auth (email/password)
2. **Supabase** returns JWT with user claims
3. **Frontend** sends JWT in `Authorization: Bearer <token>` header
4. **JwtAuthGuard** validates JWT against Supabase secret
5. **RolesGuard** checks if user has required role
6. **Supabase Client** uses user's JWT for database calls (respects RLS)

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| FIELD | Create incidents, add patients/vitals/interventions, view own data |
| COMMAND | View all incidents for hospital, update status, view all patients |
| ADMIN | Full access to all data and user management |

## Integration with Supabase

The backend uses Supabase as the single source of truth:
- **Auth**: Supabase Auth issues JWTs
- **Database**: All data stored in Supabase PostgreSQL
- **RLS**: Row-level security enforced at database level
- **Realtime**: Database triggers + WebSocket for live updates

## Scripts

```bash
# Development
npm run start:dev

# Build
npm run build

# Production
npm run start:prod

# Lint
npm run lint

# Test
npm run test
npm run test:e2e
```
