import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';
import { MendError, ERROR_CODES } from '../lib/errors';

// Setup MSW server with dedicated handlers for wrapper tests
const server = setupServer(
  // Authentication endpoints
  http.post('https://api.example.com/session', () => {
    return HttpResponse.json({ token: 'fake-jwt-token', payload: { orgs: [{ id: 123, name: 'Test Organization' }] } });
  }),
  
  // User endpoints
  http.get('https://api.example.com/user/:userId', ({ params }) => {
    const { userId } = params;
    return HttpResponse.json({ payload: { id: Number(userId), name: 'Test User' } });
  }),
  
  // Organization endpoints
  http.get('https://api.example.com/org/:orgId', ({ params }) => {
    const { orgId } = params;
    return HttpResponse.json({ payload: { id: Number(orgId), name: 'Test Organization' } });
  }),
  http.get('https://api.example.com/org', () => {
    return HttpResponse.json({ payload: { orgs: [{ id: 123, name: 'Test Org 1' }, { id: 456, name: 'Test Org 2' }] } });
  }),
  http.put('https://api.example.com/session/org/:orgId', ({ params }) => {
    const { orgId } = params;
    return HttpResponse.json({ payload: { org_id: Number(orgId) } });
  }),
  
  // Patient endpoints
  http.get('https://api.example.com/patient/:patientId', ({ params }) => {
    const { patientId } = params;
    return HttpResponse.json({ payload: { id: Number(patientId), name: 'Test Patient' } });
  }),
  http.get('https://api.example.com/patient/:patientId/assessment/scores', ({ params }) => {
    const { patientId } = params;
    return HttpResponse.json({ payload: [{ id: 1, patient_id: Number(patientId), score: 85 }] });
  }),
  http.get('https://api.example.com/patient', ({ request }) => {
    const url = new URL(request.url);
    const nameParam = url.searchParams.get('name');
    
    if (nameParam === 'Test') {
      return HttpResponse.json({ payload: [{ id: 1, name: 'Test Patient' }] });
    }
    return HttpResponse.json({ payload: [] });
  }),
  http.post('https://api.example.com/patient', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    const url = new URL(request.url);
    const forceParam = url.searchParams.get('force');
    
    if (forceParam === 'true') {
      return HttpResponse.json({ payload: { id: 3, name: body.name, force: true } });
    }
    return HttpResponse.json({ payload: { id: 2, name: body.name } });
  }),
  // Force create patient path
  http.post('https://api.example.com/patient/force', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({ payload: { id: 3, name: body.name, force: true } });
  }),
  http.put('https://api.example.com/patient/:patientId', async ({ request, params }) => {
    const { patientId } = params;
    const body = await request.json() as Record<string, any>;
    const url = new URL(request.url);
    const forceParam = url.searchParams.get('force');
    
    if (forceParam === 'true') {
      return HttpResponse.json({ payload: { id: Number(patientId), name: body.name, force: true } });
    }
    return HttpResponse.json({ payload: { id: Number(patientId), name: body.name } });
  }),
  // Force update patient path
  http.put('https://api.example.com/patient/:patientId/force', async ({ request, params }) => {
    const { patientId } = params;
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({ payload: { id: Number(patientId), name: body.name, force: true } });
  }),
  http.delete('https://api.example.com/patient/:patientId', ({ params }) => {
    const { patientId } = params;
    return HttpResponse.json({ payload: { success: true, id: Number(patientId) } });
  }),
  
  // Appointment endpoints
  http.get('https://api.example.com/appointment/:appointmentId', ({ params }) => {
    const { appointmentId } = params;
    return HttpResponse.json({ payload: { id: Number(appointmentId), patient_id: 1, time: '2025-06-01T15:00:00Z' } });
  }),
  http.post('https://api.example.com/appointment', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({ payload: { id: 2, patient_id: body.patient_id, time: body.time } });
  }),
  
  // Property endpoints
  http.get('https://api.example.com/property', () => {
    return HttpResponse.json({ payload: { properties: { test_key: 'test_value', another_key: 'another_value' } } });
  }),
  http.get('https://api.example.com/property/:key', ({ params }) => {
    const { key } = params;
    if (key === 'test_key') {
      return HttpResponse.json({ payload: 'test_value' });
    }
    return new HttpResponse(null, { status: 404 });
  }),
  
  // Test endpoint for request method tests
  http.post('https://api.example.com/test-endpoint', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    const url = new URL(request.url);
    
    if (body?.test === 'value' && url.searchParams.get('param') === 'value') {
      return HttpResponse.json({ success: true });
    }
    return new HttpResponse(null, { status: 400 });
  })
);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

// Close server after all tests
afterAll(() => {
  server.close();
});

// Request Method Tests
describe('MendSdk Request Method', () => {
  let sdk: MendSdk;

  beforeEach(() => {
    // Create a fresh SDK instance for each test with an orgId to bypass org selection
    sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      orgId: 123
    });
  });

  it('should make authenticated requests', async () => {
    const result = await sdk.request('GET', '/user/1');
    expect(result).toBeDefined();
    expect((result as any).payload).toBeDefined();
  });
  
  it('should handle request with body and query params', async () => {
    const result = await sdk.request(
      'POST',
      '/test-endpoint',
      { test: 'value' },
      { param: 'value' }
    );
    
    expect(result).toEqual({ success: true });
  });
  
  it('should handle AbortController signal', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    
    const controller = new AbortController();
    await sdk.request('GET', '/user/1', undefined, undefined, controller.signal);
    
    // Verify the request was called with the signal
    expect(requestSpy).toHaveBeenCalledWith(
      'GET',
      '/user/1',
      undefined,
      undefined,
      controller.signal
    );
  });
});

// Convenience Wrapper Tests
describe('MendSdk Convenience Methods', () => {
  let sdk: MendSdk;

  beforeEach(() => {
    // Create a fresh SDK instance for each test
    sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      orgId: 123 // Avoid org selection logic in tests
    });
  });

  // Organization methods
  it('should get organization details', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getOrg(1);
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/org/1', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should list organizations', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.listOrgs();
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/org', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect(Array.isArray((result as any).payload.orgs)).toBe(true);
  });

  it('should switch organization', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    await sdk.switchOrg(2);
    
    // Verify the PUT request was made to the correct endpoint
    expect(requestSpy).toHaveBeenCalledWith(
      'PUT',
      '/session/org/2',
      {},
      undefined,
      undefined
    );
  });

  // User methods
  it('should get user details', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getUser(1);
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/user/1', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  // Patient methods
  it('should search patients', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.searchPatients({ name: 'Test' });
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/patient', undefined, { name: 'Test' }, undefined);
    expect(result).toBeDefined();
    expect(Array.isArray((result as any).payload)).toBe(true);
  });

  it('should get patient details', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getPatient(1);
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/patient/1', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });



  it('should create patient', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.createPatient({ name: 'New Patient' });
    
    expect(requestSpy).toHaveBeenCalledWith('POST', '/patient', { name: 'New Patient' }, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(2);
  });



  it('should update patient', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.updatePatient(1, { name: 'Updated Patient' });
    
    expect(requestSpy).toHaveBeenCalledWith('PUT', '/patient/1', { name: 'Updated Patient' }, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });



  it('should delete patient', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.deletePatient(1);
    
    expect(requestSpy).toHaveBeenCalledWith('DELETE', '/patient/1', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.success).toBe(true);
  });

  // Appointment methods
  it('should get appointment', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getAppointment(1);
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/appointment/1', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should create appointment', async () => {
    const appointmentData = { patient_id: 1, time: '2025-06-01T15:00:00Z' };
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.createAppointment(appointmentData);
    
    expect(requestSpy).toHaveBeenCalledWith('POST', '/appointment', appointmentData, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(2);
  });

  // Property methods
  it('should get all properties', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getProperties();
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/property', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.properties).toBeDefined();
  });

  it('should create patient with force flag', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.createPatient({ name: 'Forced Patient' }, true);

    expect(requestSpy).toHaveBeenCalledWith('POST', '/patient/force', { name: 'Forced Patient' }, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.force).toBe(true);
  });

  it('should update patient with force flag', async () => {
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.updatePatient(1, { name: 'Forced Update' }, true);

    expect(requestSpy).toHaveBeenCalledWith('PUT', '/patient/1/force', { name: 'Forced Update' }, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.force).toBe(true);
  });

  it('should throw on 404 when switching organization', async () => {
    server.use(
      http.put('https://api.example.com/session/org/:orgId', () => new HttpResponse(null, { status: 404 }))
    );

    await expect(sdk.switchOrg(999)).rejects.toMatchObject({
      status: 404,
      code: ERROR_CODES.HTTP_ERROR,
    });
  });


});
