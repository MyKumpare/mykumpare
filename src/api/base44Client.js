import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  // Use the absolute API URL so calls work on GitHub Pages (no Vite proxy).
  // Falls back to '' for local dev where the Vite proxy handles /api/* routing.
  serverUrl: appBaseUrl || '',
  requiresAuth: false,
  appBaseUrl
});
