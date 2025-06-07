import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MendSdk } from '../../lib/index';
import { afterEach, beforeEach, vi } from 'vitest';
import { HttpClient, HttpVerb, QueryParams } from '../../lib/http';

// Standard mock responses
export const mockResponses = {
  auth: {
    success: {
      status: 'success',
      payload: {
        jwt: 'auth-jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        user: { id: 1, name: 'Test User' },
        organizations: [{ id: 123, name: 'Test Org' }]
      },
    },
    mfa: {
      status: 'mfa_required',
      mfaToken: 'mfa-token',
    },
    mfaComplete: {
      status: 'success',
      payload: {
        jwt: 'auth-jwt-token-after-mfa',
        refreshToken: 'refresh-token-after-mfa',
        expiresIn: 3600,
        user: { id: 1, name: 'Test User' },
        organizations: [{ id: 123, name: 'Test Org' }]
      },
    },
  },
  refresh: {
    success: {
      status: 'success',
      payload: {
        jwt: 'refreshed-jwt-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      },
    },
  },
  organizations: {
    list: {
      status: 'success',
      payload: [
        { id: 123, name: 'Test Organization' },
        { id: 456, name: 'Another Organization' },
      ],
    },
    get: {
      status: 'success',
      payload: { id: 123, name: 'Test Organization' },
    },
    switch: {
      status: 'success',
    },
  },
  users: {
    get: {
      status: 'success',
      payload: {
        id: 1,
        name: 'Test User 1',
        email: 'test@example.com',
      },
    },
  },
  patients: {
    search: {
      status: 'success',
      payload: [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' },
      ],
    },
    get: {
      status: 'success',
      payload: { id: 1, name: 'John Doe' },
    },
    create: {
      status: 'success',
      payload: { id: 3, name: 'New Patient' },
    },
    update: {
      status: 'success',
      payload: { id: 1, name: 'Updated Patient' },
    },
    delete: {
      status: 'success',
    },
    assessmentScores: {
      status: 'success',
      payload: [
        { id: 1, score: 85 },
        { id: 2, score: 90 },
      ],
    },
  },
  appointments: {
    get: {
      status: 'success',
      payload: { id: 1, patientId: 1, date: '2023-01-01' },
    },
    create: {
      status: 'success',
      payload: { id: 2, patientId: 1, date: '2023-02-01' },
    },
  },
  properties: {
    list: {
      status: 'success',
      payload: [
        { key: 'test_key', value: 'test_value' },
        { key: 'another_key', value: 'another_value' },
      ],
    },
    get: {
      status: 'success',
      payload: 'test_value',
    },
  },
  errors: {
    unauthorized: {
      status: 'error',
      message: 'Unauthorized',
      code: 'UNAUTHORIZED',
    },
  },
};

// Set up MSW server with standard handlers and additional custom handlers
export function setupMswServer(additionalHandlers: any[] = []) {
  const server = setupServer(
    // Authentication endpoints
    http.post('*/session', async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        mfaToken?: string;
        mfaCode?: string;
      };
      const { email, mfaToken, mfaCode } = body;

      if (mfaToken && mfaCode) {
        return HttpResponse.json(mockResponses.auth.mfaComplete);
      }

      if (email === 'mfa@example.com') {
        return HttpResponse.json(mockResponses.auth.mfa);
      }

      return HttpResponse.json(mockResponses.auth.success);
    }),

    // Switch organization
    http.put('*/session/org/:orgId', () => {
      return HttpResponse.json({ status: 'success' });
    }),

    // Patient endpoints
    http.get('*/patient', () => {
      return HttpResponse.json({
        status: 'success',
        patients: [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' },
        ],
      });
    }),

    http.get('*/patient/:id', ({ params }) => {
      const { id } = params;
      return HttpResponse.json({
        status: 'success',
        patient: { id: Number(id), name: 'Test Patient' },
      });
    }),

    http.post('*/patient', async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return HttpResponse.json({
        status: 'success',
        patient: { id: 3, ...body },
      });
    }),

    http.put('*/patient/:id', async ({ params, request }) => {
      const { id } = params;
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return HttpResponse.json({
        status: 'success',
        patient: { id: Number(id), ...body },
      });
    }),

    http.delete('*/patient/:id', () => {
      return HttpResponse.json({ status: 'success' });
    }),

    // Assessment scores endpoint
    http.get('*/patient/:id/assessment-scores', () => {
      return HttpResponse.json({
        status: 'success',
        scores: [{ id: 1, score: 85 }],
      });
    }),

    // Property endpoints
    http.get('*/property', () => {
      return HttpResponse.json({
        status: 'success',
        properties: [
          { key: 'test_key', value: 'test_value' },
          { key: 'another_key', value: 'another_value' },
        ],
      });
    }),

    http.get('*/property/:key', ({ params }) => {
      const { key } = params;
      return HttpResponse.json({
        status: 'success',
        value: `value_for_${key}`,
      });
    }),

    // Handle specific property key lookups for tests that expect this format
    http.get('https://api.example.com/property/test_key', () => {
      return HttpResponse.json({ status: 'success', value: 'test_value' });
    }),

    // Ensure all domains for property endpoints are covered
    http.get('https://api.example.com/property/:key', ({ params }) => {
      const { key } = params;
      return HttpResponse.json({
        status: 'success',
        value: `value_for_${key}`,
      });
    }),

    http.get('https://api.example.com/property', () => {
      return HttpResponse.json({
        status: 'success',
        properties: [
          { key: 'test_key', value: 'test_value' },
          { key: 'another_key', value: 'another_value' },
        ],
      });
    }),

    // Appointment endpoints
    http.get('*/appointment/:id', ({ params }) => {
      const { id } = params;
      return HttpResponse.json({
        status: 'success',
        appointment: { id: Number(id), patientId: 1, date: '2023-01-01' },
      });
    }),

    http.post('*/appointment', async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      return HttpResponse.json({
        status: 'success',
        appointment: { id: 1, ...body },
      });
    }),

    // Organization endpoints
    http.get('*/organization', () => {
      return HttpResponse.json({
        status: 'success',
        organizations: [
          { id: 123, name: 'Test Org' },
          { id: 456, name: 'Another Org' },
        ],
      });
    }),

    http.get('*/organization/:id', ({ params }) => {
      const { id } = params;
      return HttpResponse.json({
        status: 'success',
        organization: { id: Number(id), name: 'Test Org' },
      });
    }),

    // Add additional handlers
    ...additionalHandlers,
  );

  // Start MSW server before tests with bypassing unhandled requests rather than erroring
  server.listen({ onUnhandledRequest: 'bypass' });

  return server;
}

// Create a setup function that provides a pre-authenticated SDK instance
export function createTestSdk() {
  // Create a new SDK instance with test credentials
  const sdk = new MendSdk({
    apiEndpoint: 'https://api.example.com',
    email: 'test@example.com',
    password: 'password123',
    orgId: 123, // Set an organization ID to avoid org selection logic in tests
  });

  // Set authentication tokens directly to bypass authentication
  (sdk as any).jwt = 'auth-jwt-token';
  (sdk as any).refreshToken = 'refresh-token';
  (sdk as any).currentOrg = 123;
  // Set expiration time in the future to prevent re-authentication
  (sdk as any).jwtExpiresAt = Date.now() + 3600000; // 1 hour in the future

  // Also ensure the httpClient doesn't make real network requests
  // by replacing the fetch implementation
  if (!(sdk as any).httpClient) {
    (sdk as any).httpClient = new HttpClient({
      apiEndpoint: 'https://api.example.com',
    });
  }

  return sdk;
}

// Create a mock HttpClient to avoid actual network requests
export function createMockHttpClient() {
  beforeEach(() => {
    // Spy on the HttpClient.fetch method
    vi.spyOn(HttpClient.prototype, 'fetch').mockImplementation(function (
      this: HttpClient,
      method: HttpVerb,
      path: string,
      body?: unknown,
      query?: QueryParams,
      headers?: Record<string, string>,
      signal?: AbortSignal,
    ) {
      // For testing, always return a successful response for any unhandled request
      // This prevents actual network requests from being made
      console.log(`[Mock HttpClient] ${method} ${path}`);
      return Promise.resolve({
        status: 'success',
        data: { mocked: true, path, method },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}
