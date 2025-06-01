import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from './index';
import { MendError, ERROR_CODES } from './errors';

// Setup MSW server
const server = setupServer(
  // Default handlers
  http.post('https://api.example.com/session', () => {
    return HttpResponse.json({
      token: 'fake-jwt-token',
      payload: {
        orgs: [
          { id: 123, name: 'Test Organization' }
        ]
      }
    });
  }),
  
  // Add more handlers as needed
  http.put('https://api.example.com/session/org/123', () => {
    return HttpResponse.json({ success: true });
  }),
  
  http.get('https://api.example.com/user/1', () => {
    return HttpResponse.json({
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    });
  })
);

// Start server before all tests
beforeAll(() => server.listen());
// Reset handlers after each test
afterEach(() => server.resetHandlers());
// Close server after all tests
afterAll(() => server.close());

describe('MendSdk', () => {
  it('should initialize with valid configuration', () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123'
    });
    
    expect(sdk).toBeInstanceOf(MendSdk);
  });
  
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
  
  it('should authenticate successfully and retrieve a token', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123'
    });
    
    // This will internally call authenticate() through ensureAuth()
    const user = await sdk.getUser(1);
    
    expect(user).toBeDefined();
    expect((user as any).id).toBe(1);
    expect((user as any).name).toBe('Test User');
  });
  
  it('should throw an error when authentication fails', async () => {
    // Override the default handler for this specific test
    server.use(
      http.post('https://api.example.com/session', () => {
        return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      })
    );
    
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'wrong@example.com',
      password: 'wrongpassword'
    });
    
    await expect(sdk.getUser(1)).rejects.toThrow(MendError);
    
    try {
      await sdk.getUser(1);
    } catch (error) {
      expect(error).toBeInstanceOf(MendError);
      expect((error as MendError).code).toBe(ERROR_CODES.HTTP_ERROR);
      expect((error as MendError).status).toBe(401);
    }
  });
});
