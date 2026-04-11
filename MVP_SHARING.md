# MVP Sharing Guide

## Problem
Your backend is currently running on `172.20.10.2:3000` which is a **local network IP**. When you change networks or share with others, this IP changes and the app won't connect.

## Solutions (Pick One)

### Option 1: ngrok (Easiest - Recommended for Demo)
Creates a public URL that tunnels to your local backend.

```bash
# Install ngrok
npm install -g ngrok

# Start your backend first (on 0.0.0.0:3000)
cd backend
npm run start:dev

# In another terminal, create tunnel
ngrok http 3000
```

You'll get a public URL like `https://abc123.ngrok.io`:
1. Update `field-mobile/src/config/api.ts` - change `baseURL` to your ngrok URL
2. Rebuild the mobile app
3. Share the app + backend URL with anyone

**Pros:** Free, works immediately, HTTPS included
**Cons:** URL changes every time you restart ngrok (unless you pay for a static domain)

---

### Option 2: Cloudflare Tunnel (Free Static URL)
More permanent solution with a custom subdomain.

```bash
# Install cloudflared
# Windows (PowerShell admin)
winget install Cloudflare.cloudflared

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create ems-backend

# Route traffic
cloudflared tunnel route dns ems-backend ems-backend.yourdomain.com

# Start tunnel
cloudflared tunnel run ems-backend --url http://localhost:3000
```

**Pros:** Free static URL, always available
**Cons:** Requires more setup

---

### Option 3: Deploy to Cloud (Most Professional)
Deploy backend to a cloud service for permanent access.

#### Railway.app (Easiest)
1. Push code to GitHub
2. Connect Railway to your repo
3. Add environment variables
4. Get a public URL automatically

#### Render.com (Free Tier)
1. Create `render.yaml` in repo root
2. Connect GitHub account
3. Deploy with free tier

#### Fly.io (Free Tier)
```bash
# Install flyctl
winget install Flyio.flyctl

# Deploy
fly launch
fly deploy
```

**Pros:** Professional, always-on, scalable
**Cons:** Requires deployment knowledge, potential costs

---

### Option 4: Same WiFi Network (Quick Testing)
If demoing to someone in the same room:

1. **Find your computer's IP:**
   ```bash
   ipconfig  # Windows
   # Look for "IPv4 Address" under your WiFi adapter
   ```

2. **Update mobile app config:**
   ```typescript
   // field-mobile/src/config/api.ts
   baseURL: 'http://YOUR_IP:3000',
   ```

3. **Ensure backend binds to all interfaces:**
   ```bash
   # In backend main.ts - already configured
   await app.listen(3000, '0.0.0.0');
   ```

4. **Disable Windows Firewall** or allow port 3000

**Pros:** No external services needed
**Cons:** Only works on same network, IP changes when you move

---

## Recommended Setup for MVP Demo

### For Immediate Sharing (Today):
```bash
# 1. Start backend
cd backend
npm run start:dev

# 2. In new terminal, start ngrok
ngrok http 3000

# 3. Copy the HTTPS URL (e.g., https://abc123.ngrok-free.app)

# 4. Update mobile config
# field-mobile/src/config/api.ts:
#   baseURL: 'https://abc123.ngrok-free.app'

# 5. Restart Expo app
```

### For Persistent Sharing:
Deploy to Railway or Render (Option 3) for a permanent URL that never changes.

---

## Environment Variables Template

Create `field-mobile/.env` for different environments:

```bash
# Development (local)
API_URL=http://172.20.10.2:3000

# Staging (ngrok - update each session)
API_URL=https://your-ngrok-url.ngrok-free.app

# Production (deployed)
API_URL=https://your-app.railway.app
```

---

## Quick Checklist for Sharing

- [ ] Backend running and accessible
- [ ] Mobile app has correct API URL
- [ ] Supabase project accessible from public IP
- [ ] Test on a different device/network
- [ ] Document the demo credentials
