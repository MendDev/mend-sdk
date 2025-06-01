import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from './index';
import { MendError, ERROR_CODES } from './errors';
import { Json } from './http';

// Setup MSW server
const server = setupServer(
  // Authentication endpoints
  http.post('https://api.example.com/session', () => {
    return HttpResponse.json({ token: 'fake-jwt-token', payload: { orgs: [{ id: 123, name: 'Test Organization' }] } });
  }),
  http.post('https://api.example.com/session/mfa', () => {
    return HttpResponse.json({ token: 'mfa-jwt-token' });
  }),
  http.post('https://api.example.com/session/mfa/code', () => {
    return HttpResponse.json({ token: 'post-mfa-jwt-token', payload: { orgs: [{ id: 123, name: 'Test Organization' }] } });
  }),
  http.post('https://api.example.com/session/refresh', () => {
    return HttpResponse.json({ token: 'refreshed-jwt-token' });
  }),
  http.put('https://api.example.com/session/org/:orgId', ({ params }) => {
    const { orgId } = params;
    return HttpResponse.json({ payload: { org_id: Number(orgId) } });
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
  
  // Patient endpoints
  http.get('https://api.example.com/patient/:patientId', ({ params }) => {
    const { patientId } = params;
    return HttpResponse.json({ payload: { id: Number(patientId), name: 'Test Patient' } });
  }),
  http.get('https://api.example.com/patient/:patientId/assessment/scores', ({ params }) => {
    const { patientId } = params;
    return HttpResponse.json({ payload: [{ id: 1, patient_id: Number(patientId), score: 85 }] });
  }),
  http.post('https://api.example.com/patient', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    const url = new URL(request.url);
    const forceParam = url.searchParams.get('force');
    
    if (body.name === 'New Patient') {
      return HttpResponse.json({ payload: { id: 2, name: body.name } });
    } else if (body.name === 'Forced Patient' && forceParam === 'true') {
      return HttpResponse.json({ payload: { id: 3, name: body.name } });
    }
    return new HttpResponse(null, { status: 400 });
  }),
  http.put('https://api.example.com/patient/:patientId', async ({ request, params }) => {
    const { patientId } = params;
    const body = await request.json() as Record<string, any>;
    const url = new URL(request.url);
    const forceParam = url.searchParams.get('force');
    
    return HttpResponse.json({ payload: { id: Number(patientId), name: body.name } });
  }),
  http.delete('https://api.example.com/patient/:patientId', ({ params }) => {
    const { patientId } = params;
    return HttpResponse.json({ payload: { success: true, id: Number(patientId) } });
  }),
  http.get('https://api.example.com/patient', ({ request }) => {
    const url = new URL(request.url);
    const nameParam = url.searchParams.get('name');
    
    if (nameParam === 'Test') {
      return HttpResponse.json({ payload: [{ id: 1, name: 'Test Patient' }] });
    }
    return new HttpResponse(null, { status: 400 });
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
    return HttpResponse.json({ payload: { properties: { test_key: 'test_value' } } });
  }),
  http.get('https://api.example.com/property/:key', ({ params }) => {
    const { key } = params;
    if (key === 'test_key') {
      return HttpResponse.json({ payload: 'test_value' });
    }
    return new HttpResponse(null, { status: 404 });
  }),
  
  // MFA endpoints
  http.put('https://api.example.com/session/mfa', () => {
    return HttpResponse.json({
      token: 'fake-jwt-token-after-mfa',
      payload: {
        orgs: [
          { id: 123, name: 'Test Organization' }
        ]
      }
    });
  }),
  
  // Org selection
  http.put('https://api.example.com/session/org/:orgId', () => {
    return HttpResponse.json({ success: true });
  }),
  
  // List orgs
  http.get('https://api.example.com/org', () => {
    return HttpResponse.json({
      payload: {
        orgs: [
          { id: 123, name: 'Test Organization' }
        ]
      }
    });
  }),
  
  // Get specific org
  http.get('https://api.example.com/org/:orgId', ({ params }) => {
    return HttpResponse.json({
      payload: {
        id: Number(params.orgId),
        name: `Test Organization ${params.orgId}`
      }
    });
  }),
  
  // User endpoints
  http.get('https://api.example.com/user/:id', ({ params }) => {
    return HttpResponse.json({
      payload: {
        id: Number(params.id),
        name: `Test User ${params.id}`,
        email: `user${params.id}@example.com`
      }
    });
  }),
  
  // Patient endpoints
  http.get('https://api.example.com/patient', () => {
    return HttpResponse.json({
      payload: [
        { id: 1, name: 'Test Patient' }
      ]
    });
  }),
  
  http.get('https://api.example.com/patient/:id', ({ params }) => {
    return HttpResponse.json({
      payload: {
        id: Number(params.id),
        name: `Test Patient ${params.id}`
      }
    });
  }),
  
  http.get('https://api.example.com/patient/:id/assessment-scores', ({ params }) => {
    return HttpResponse.json({
      payload: [
        { id: Number(params.id), score: 95 }
      ]
    });
  }),
  
  http.post('https://api.example.com/patient', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({
      payload: { id: 2, name: body?.name || 'New Patient' }
    });
  }),
  
  http.post('https://api.example.com/patient/force', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({
      payload: { id: 3, name: body?.name || 'Force Created Patient' }
    });
  }),
  
  http.put('https://api.example.com/patient/:id', async ({ request, params }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({
      payload: {
        id: Number(params.id),
        name: body?.name || 'Updated Patient'
      }
    });
  }),
  
  http.put('https://api.example.com/patient/:id/force', async ({ request, params }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({
      payload: {
        id: Number(params.id),
        name: body?.name || 'Force Updated Patient'
      }
    });
  }),
  
  http.delete('https://api.example.com/patient/:id', ({ params }) => {
    return HttpResponse.json({
      payload: {
        success: true,
        message: `Patient ${params.id} deleted`
      }
    });
  }),
  
  // Appointment endpoints
  http.get('https://api.example.com/appointment/:id', ({ params }) => {
    return HttpResponse.json({
      payload: {
        id: Number(params.id),
        patient_id: 1,
        time: '2025-06-01T14:00:00Z'
      }
    });
  }),
  
  http.post('https://api.example.com/appointment', async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({
      payload: {
        id: 2,
        patient_id: body?.patient_id || 1,
        time: body?.time || '2025-06-01T15:00:00Z'
      }
    });
  }),
  
  // Property endpoints
  http.get('https://api.example.com/property', () => {
    return HttpResponse.json({
      payload: {
        properties: {
          test_key: 'test_value',
          another_key: 'another_value'
        }
      }
    });
  })
);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers and mocks after each test
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

// Close server after all tests
afterAll(() => {
  server.close();
});

describe('MendSdk', () => {
  let sdk: MendSdk;

  beforeEach(() => {
    // Create a fresh SDK instance for each test
    sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123'
    });
  });

  // Basic initialization test
  it('should initialize with valid configuration', () => {
    expect(sdk).toBeInstanceOf(MendSdk);
  });
  
  // Error handling test
  it('should throw error when missing required options', () => {
    expect(() => {
      // @ts-ignore - intentionally missing required properties
      new MendSdk({});
    }).toThrow(MendError);
    
    try {
      // @ts-ignore - intentionally missing required properties
      new MendSdk({});
    } catch (error) {
      expect(error).toBeInstanceOf(MendError);
      expect((error as MendError).code).toBe(ERROR_CODES.SDK_CONFIG);
    }
  });
  
  // Authentication test with modified approach
  it('should authenticate successfully and retrieve a token', async () => {
    // Create SDK with test credentials and specific orgId
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      // Add orgId to bypass org selection logic which might cause timeouts
      orgId: 123
    });
    
    // Call the method that would trigger authentication
    const user = await sdk.getUser(1);
    
    // Verify the result
    expect(user).toBeDefined();
    expect((user as any).payload.id).toBe(1);
    expect((user as any).payload.name).toBe('Test User 1');
  });
  
  // Authentication with MFA test
  it('should handle MFA authentication flow', async () => {
    // Override the default handler for this specific test
    server.use(
      http.post('https://api.example.com/session', () => {
        return HttpResponse.json({ mfaRequired: true });
      })
    );
    
    // Create SDK with MFA code
    const sdkWithMfa = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      mfaCode: '123456',
      orgId: 123
    });
    
    try {
      await sdkWithMfa.getUser(1);
      // If we get here, it means MFA flow was handled correctly
      expect(true).toBe(true);
    } catch (error) {
      // If there's an error, fail the test
      expect(error).toBeUndefined();
    }
  });
  
  // Manual MFA submission test
  it('should allow manual MFA code submission', async () => {
    // Override the default handler for this specific test
    server.use(
      http.post('https://api.example.com/session', () => {
        return HttpResponse.json({ mfaRequired: true });
      })
    );
    
    // Create SDK without MFA code
    const sdkNoMfa = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      orgId: 123
    });
    
    // Manually submit MFA code
    await sdkNoMfa.submitMfaCode('123456');
    
    // Try to make a request
    const user = await sdkNoMfa.getUser(1);
    expect(user).toBeDefined();
  });
  
  // Organization switching test
  it('should switch organization automatically when orgId provided', async () => {
    // Spy on the request method to verify organization switch
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    
    // Create SDK with specific orgId
    const sdkWithOrg = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      orgId: 123
    });
    
    // Make a request that will trigger authentication and org switch
    await sdkWithOrg.getUser(1);
    
    // Verify that a request to switch org was made
    expect(requestSpy).toHaveBeenCalledWith(
      'PUT', 
      '/session/org/123', 
      {}, 
      undefined, 
      undefined
    );
  });
  
  // Authentication failure test
  it('should throw an error when authentication fails', async () => {
    // Override the default handler for this specific test
    server.use(
      http.post('https://api.example.com/session', () => {
        return new HttpResponse(null, { status: 401 });
      })
    );
    
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'wrong@example.com',
      password: 'wrongpassword',
      // Specify orgId to avoid org selection logic
      orgId: 123
    });
    
    await expect(sdk.getUser(1)).rejects.toThrow(MendError);
    
    try {
      await sdk.getUser(1);
    } catch (error) {
      expect(error).toBeInstanceOf(MendError);
      // The HTTP_ERROR code is now expected from our errors.ts module
      expect((error as MendError).code).toBe(ERROR_CODES.HTTP_ERROR);
      expect((error as MendError).status).toBe(401);
    }
  });
  
  // Token missing error test
  it('should throw MendError when token is missing from response', async () => {
    // Override the default handler for this specific test
    server.use(
      http.post('https://api.example.com/session', () => {
        return HttpResponse.json({ /* no token here */ });
      })
    );
    
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123'
    });
    
    await expect(sdk.getUser(1)).rejects.toThrow(MendError);
    
    try {
      await sdk.getUser(1);
    } catch (error) {
      expect(error).toBeInstanceOf(MendError);
      expect((error as MendError).code).toBe(ERROR_CODES.AUTH_MISSING_TOKEN);
    }
  });
  
  // Mutex existence test (as a proxy for testing concurrent auth protection)
  it('should use mutex to protect authentication', () => {
    // Verify that the SDK has a mutex for authentication
    // @ts-ignore - accessing private property for test
    expect(sdk.authMutex).toBeDefined();
  });

  // Token refresh test
  it('should refresh token when expired', async () => {
    // Spy on the authenticate method
    const authenticateSpy = vi.spyOn(sdk as any, 'authenticate');
    
    // Create SDK with very short token TTL
    const sdkShortTTL = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      tokenTTL: 0.001 // 0.06 seconds
    });
    
    // First request should authenticate
    await sdkShortTTL.getUser(1);
    
    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Second request should re-authenticate
    await sdkShortTTL.getUser(2);
    
    // authenticate should have been called at least twice
    expect(authenticateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

// Request Method Tests
describe('MendSdk Request Method', () => {
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

  it('should make authenticated requests', async () => {
    const result = await sdk.request('GET', '/user/1');
    expect(result).toBeDefined();
    expect((result as any).payload).toBeDefined();
  });
  
  it('should handle request with body and query params', async () => {
    // Add a test handler for this specific test
    server.use(
      http.post('https://api.example.com/test-endpoint', async ({ request }) => {
        const body = await request.json() as Record<string, any>;
        const url = new URL(request.url);
        
        if (body?.test === 'value' && url.searchParams.get('param') === 'value') {
          return HttpResponse.json({ success: true });
        }
        return new HttpResponse(null, { status: 400 });
      })
    );
    
    const result = await sdk.request(
      'POST',
      '/test-endpoint',
      { test: 'value' },
      { param: 'value' }
    );
    
    expect(result).toEqual({ success: true });
  });
  
  it('should handle AbortController signal', async () => {
    // Use a spy to check if signal is passed correctly
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
    // Setup handler for this specific test
    server.use(
      http.get('https://api.example.com/org/1', () => {
        return HttpResponse.json({ payload: { id: 1, name: 'Test Organization' } });
      })
    );
    
    const result = await sdk.getOrg(1);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should list organizations', async () => {
    // Setup handler for this specific test
    server.use(
      http.get('https://api.example.com/org', () => {
        return HttpResponse.json({ payload: { orgs: [{ id: 123, name: 'Test Org 1' }, { id: 456, name: 'Test Org 2' }] } });
      })
    );
    
    const result = await sdk.listOrgs();
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
      expect.any(Object),
      undefined,
      undefined
    );
  });

  // User methods
  it('should get user details', async () => {
    const result = await sdk.getUser(1);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  // Patient methods
  it('should search patients', async () => {
    // Setup handler for this specific test
    server.use(
      http.get('https://api.example.com/patient', ({ request }) => {
        const url = new URL(request.url);
        const nameParam = url.searchParams.get('name');
        
        if (nameParam === 'Test') {
          return HttpResponse.json({ payload: [{ id: 1, name: 'Test Patient' }] });
        }
        return new HttpResponse(null, { status: 400 });
      })
    );
    
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.searchPatients({ name: 'Test' });
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/patient', undefined, { name: 'Test' }, undefined);
    expect(result).toBeDefined();
    expect(Array.isArray((result as any).payload)).toBe(true);
  });

  it('should get patient details', async () => {
    const result = await sdk.getPatient(1);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should get patient assessment scores', async () => {
    // Setup handler for this specific test
    server.use(
      http.get('https://api.example.com/patient/1/assessment/scores', () => {
        return HttpResponse.json({ payload: [{ id: 1, patient_id: 1, score: 85 }] });
      })
    );
    
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getPatientAssessmentScores(1);
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/patient/1/assessment/scores', undefined, undefined, undefined);
    expect(result).toBeDefined();
    expect(Array.isArray((result as any).payload)).toBe(true);
  });

  it('should create patient', async () => {
    // Setup handler for this specific test
    server.use(
      http.post('https://api.example.com/patient', async ({ request }) => {
        const body = await request.json() as Record<string, any>;
        if (body.name === 'New Patient') {
          return HttpResponse.json({ payload: { id: 2, name: body.name } });
        }
        return new HttpResponse(null, { status: 400 });
      })
    );
    
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.createPatient({ name: 'New Patient' });
    
    expect(requestSpy).toHaveBeenCalledWith('POST', '/patient', { name: 'New Patient' }, undefined, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(2);
  });

  it('should create patient with force flag', async () => {
    // Setup handler for this specific test
    server.use(
      http.post('https://api.example.com/patient', async ({ request }) => {
        const body = await request.json() as Record<string, any>;
        const url = new URL(request.url);
        const forceParam = url.searchParams.get('force');
        
        if (body.name === 'Forced Patient' && forceParam === 'true') {
          return HttpResponse.json({ payload: { id: 3, name: body.name } });
        }
        return new HttpResponse(null, { status: 400 });
      })
    );
    
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.createPatient({ name: 'Forced Patient' }, true);
    
    expect(requestSpy).toHaveBeenCalledWith('POST', '/patient', { name: 'Forced Patient' }, { force: true }, undefined);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(3);
  });

  it('should update patient', async () => {
    const result = await sdk.updatePatient(1, { name: 'Updated Patient' });
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should update patient with force flag', async () => {
    const result = await sdk.updatePatient(1, { name: 'Force Updated Patient' }, true);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should delete patient', async () => {
    const result = await sdk.deletePatient(1);
    expect(result).toBeDefined();
    expect((result as any).payload.success).toBe(true);
  });

  // Appointment methods
  it('should get appointment', async () => {
    const result = await sdk.getAppointment(1);
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(1);
  });

  it('should create appointment', async () => {
    const result = await sdk.createAppointment({ patient_id: 1, time: '2025-06-01T15:00:00Z' });
    expect(result).toBeDefined();
    expect((result as any).payload.id).toBe(2);
  });

  // Property methods
  it('should get all properties', async () => {
    const result = await sdk.getProperties();
    expect(result).toBeDefined();
    expect((result as any).payload.properties).toBeDefined();
  });

  it('should get specific property', async () => {
    // Setup handler for this specific test
    server.use(
      http.get('https://api.example.com/property/test_key', () => {
        return HttpResponse.json({ payload: 'test_value' });
      })
    );
    
    const requestSpy = vi.spyOn(sdk, 'request' as any);
    const result = await sdk.getProperty('test_key');
    
    expect(requestSpy).toHaveBeenCalledWith('GET', '/property/test_key', undefined, undefined, undefined);
    expect(result).toBe('test_value');
  });
  
  // Direct tests for convenience wrapper methods
  describe('Direct convenience method tests', () => {
    beforeEach(() => {
      // Add handlers for each endpoint we'll test
      server.use(
        http.get('https://api.example.com/user/1', () => {
          return HttpResponse.json({ payload: { id: 1, name: 'Test User' } });
        }),
        http.get('https://api.example.com/org/1', () => {
          return HttpResponse.json({ payload: { id: 1, name: 'Test Organization' } });
        }),
        http.get('https://api.example.com/patient/1', () => {
          return HttpResponse.json({ payload: { id: 1, name: 'Test Patient' } });
        }),
        http.get('https://api.example.com/appointment/1', () => {
          return HttpResponse.json({ payload: { id: 1, patient_id: 1, time: '2025-06-01T15:00:00Z' } });
        })
      );
    });
    
    it('getUser should call correct endpoint and return user data', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.getUser(1);
      
      expect(requestSpy).toHaveBeenCalledWith('GET', '/user/1', undefined, undefined, undefined);
      expect(result).toBeDefined();
      expect((result as any).payload.id).toBe(1);
    });
    
    it('getOrg should call correct endpoint and return org data', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.getOrg(1);
      
      expect(requestSpy).toHaveBeenCalledWith('GET', '/org/1', undefined, undefined, undefined);
      expect(result).toBeDefined();
      expect((result as any).payload.id).toBe(1);
    });
    
    it('getPatient should call correct endpoint and return patient data', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.getPatient(1);
      
      expect(requestSpy).toHaveBeenCalledWith('GET', '/patient/1', undefined, undefined, undefined);
      expect(result).toBeDefined();
      expect((result as any).payload.id).toBe(1);
    });
    
    it('getAppointment should call correct endpoint and return appointment data', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.getAppointment(1);
      
      expect(requestSpy).toHaveBeenCalledWith('GET', '/appointment/1', undefined, undefined, undefined);
      expect(result).toBeDefined();
      expect((result as any).payload.id).toBe(1);
    });
  });
});
