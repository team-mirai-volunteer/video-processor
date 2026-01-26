import { backendClient } from './backend-client';
import { mockBackendClient } from './mock-backend-client';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export function getBackendClient() {
  return USE_MOCK ? mockBackendClient : backendClient;
}
