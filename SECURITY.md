# Security Guide for EMS System

## ⚠️ CRITICAL: Never Commit These Files

### Backend (`backend/`)
- **`.env`** - Contains `SUPABASE_SERVICE_ROLE_KEY` (GOD MODE KEY)
  - This key bypasses ALL Row Level Security (RLS)
  - Can read/write ANY data in your database
  - Can delete your entire database
  - **NEVER** commit this file

### Safe to Commit
- `.env.example` - Template with dummy values
- All source code files
- Configuration files (without secrets)

---

## 🔑 Understanding Supabase Keys

| Key Type | Location | Security Level | What It Can Do |
|----------|----------|----------------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Backend ONLY | **TOP SECRET** | Bypass RLS, full database access |
| `SUPABASE_ANON_KEY` | Frontend/Mobile | **Public** | Normal user access, respects RLS |

### Current Setup (Safe)
- ✅ Backend uses `SERVICE_ROLE_KEY` (kept secret)
- ✅ Mobile uses `ANON_KEY` (public, safe)

---

## 🚀 Safe Render Deployment

### Step 1: Verify .env is NOT committed
```bash
cd backend
git status
# Should NOT show .env in the list
```

### Step 2: Commit code WITHOUT secrets
```bash
git add .
git commit -m "Add backend and mobile code"
git push origin main
```

### Step 3: Set secrets in Render Dashboard (NOT in code)
1. Go to Render Dashboard → Your Service → Environment
2. Add these variables manually:
   ```
   SUPABASE_URL=https://ihavznutnicyvqhokuuh.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc2...  
   SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc2...
   ```

### Step 4: Deploy
- Render will pull code from GitHub (no secrets in code)
- Render will inject secrets from dashboard at runtime
- Your app is secure!

---

## 🔒 Security Checklist Before Public Repo

- [ ] `backend/.env` is in `.gitignore`
- [ ] `backend/.env` is NOT staged for commit
- [ ] No hardcoded passwords in any `.ts` files
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in backend environment variables
- [ ] Render environment variables set in dashboard, not in `render.yaml`

---

## 🚨 If You Accidentally Committed Secrets

1. **Immediately rotate keys in Supabase Dashboard**
   - Go to Supabase → Project Settings → API
   - Click "Regenerate service role key"

2. **Remove from Git history** (if pushed)
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch backend/.env" \
   --prune-empty --tag-name-filter cat -- --all
   git push origin --force --all
   ```

3. **Update Render with new keys**

---

## 📱 Mobile App Security

The mobile app contains:
- `SUPABASE_URL` - Safe (public)
- `SUPABASE_ANON_KEY` - Safe (public, client-side key)

These are designed to be exposed and respect Row Level Security (RLS) policies.
