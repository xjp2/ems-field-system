/**
 * Environment Configuration
 * 
 * This file manages different environments:
 * - development: Local development with computer IP
 * - staging: Testing environment
 * - production: Live app
 * 
 * For production builds, change ACTIVE_ENV to 'production'
 * and set PROD_API_URL to your deployed backend.
 */

type Environment = 'development' | 'staging' | 'production';

// CHANGE THIS FOR PRODUCTION BUILDS
const ACTIVE_ENV: Environment = 'production';

// Development: Your computer's local network IP
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
const DEV_API_URL = 'http://172.20.10.2:3000';  // Your computer's IP

// Staging: Your test server
const STAGING_API_URL = 'https://api-staging.emergency-response.com';

// Production: Your live server (set this when deploying!)
const PROD_API_URL = 'https://ems-backend-ygdb.onrender.com';

// Get the active API URL
export const API_BASE_URL = {
  development: DEV_API_URL,
  staging: STAGING_API_URL,
  production: PROD_API_URL,
}[ACTIVE_ENV];

// Helper to check if we're in production
export const IS_PRODUCTION = ACTIVE_ENV === 'production';

// Supabase (always used for auth - works in all environments)
export const SUPABASE_URL = 'https://ihavznutnicyvqhokuuh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloYXZ6bnV0bmljeXZxaG9rdXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ4NjIsImV4cCI6MjA5MTIzMDg2Mn0.i_n1mRcq-FIfwES-32tvSk63V5Rf_MXQe6s890lcBSY';
