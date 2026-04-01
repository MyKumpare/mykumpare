import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// The Base44 API base URL — not sensitive, just the API endpoint.
const BASE44_API_URL = appBaseUrl || 'https://api.base44.com';

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  // Absolute URL required on GitHub Pages (no Vite proxy available).
  serverUrl: BASE44_API_URL,
  requiresAuth: false,
  appBaseUrl: BASE44_API_URL
});
