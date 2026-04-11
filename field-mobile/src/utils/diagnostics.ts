import { checkApiHealth } from '../config/api';
import NetInfo from '@react-native-community/netinfo';

/**
 * Run full connection diagnostics
 * Call this from a button or on app start to debug connection issues
 */
export async function runDiagnostics(): Promise<{
  success: boolean;
  steps: { name: string; status: 'pass' | 'fail' | 'skip'; message: string }[];
}> {
  const steps: { name: string; status: 'pass' | 'fail' | 'skip'; message: string }[] = [];

  // Step 1: Check network
  try {
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      steps.push({
        name: 'Network Connection',
        status: 'pass',
        message: `Connected via ${netInfo.type}`,
      });
    } else {
      steps.push({
        name: 'Network Connection',
        status: 'fail',
        message: 'No network connection',
      });
      return { success: false, steps };
    }
  } catch (error: any) {
    steps.push({
      name: 'Network Connection',
      status: 'fail',
      message: error.message,
    });
    return { success: false, steps };
  }

  // Step 2: Check backend health
  try {
    const health = await checkApiHealth();
    if (health.ok) {
      steps.push({
        name: 'Backend Connection',
        status: 'pass',
        message: `Connected to ${health.url}`,
      });
    } else {
      steps.push({
        name: 'Backend Connection',
        status: 'fail',
        message: `Cannot reach ${health.url}: ${health.error}`,
      });
    }
  } catch (error: any) {
    steps.push({
      name: 'Backend Connection',
      status: 'fail',
      message: error.message,
    });
  }

  // Step 3: Check auth token
  try {
    const { getCurrentJWT } = await import('../config/supabase');
    const token = await getCurrentJWT();
    if (token) {
      steps.push({
        name: 'Authentication',
        status: 'pass',
        message: 'JWT token available',
      });
    } else {
      steps.push({
        name: 'Authentication',
        status: 'fail',
        message: 'No JWT token - please login',
      });
    }
  } catch (error: any) {
    steps.push({
      name: 'Authentication',
      status: 'fail',
      message: error.message,
    });
  }

  const allPassed = steps.every(s => s.status === 'pass');
  return { success: allPassed, steps };
}

/**
 * Get helpful error message based on diagnostic results
 */
export function getConnectionHelp(steps: { name: string; status: string; message: string }[]): string {
  const failedStep = steps.find(s => s.status === 'fail');
  
  if (!failedStep) {
    return 'All connections working!';
  }

  switch (failedStep.name) {
    case 'Network Connection':
      return 'Check your Wi-Fi or mobile data connection.';
    
    case 'Backend Connection':
      return `Backend not reachable.\n\n` +
        `Make sure:\n` +
        `1. Backend is running: npm run start:dev\n` +
        `2. IP address is correct in src/config/env.ts\n` +
        `3. Phone and computer are on same Wi-Fi\n` +
        `4. Firewall allows port 3000`;
    
    case 'Authentication':
      return 'Please log out and log back in.';
    
    default:
      return failedStep.message;
  }
}
