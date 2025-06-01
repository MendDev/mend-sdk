import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { HttpClient, createHttpClient } from '../lib/http';
import { MendError } from '../lib/errors';

// Setup MSW server for testing HTTP requests
const server = setupServer(
  // Default success handler
  http.get('https://api.example.com/test', () => {
    return HttpResponse.json({ success: true, data: 'test data' });
  }),
  
  // Handler for testing error responses
  http.get('https://api.example.com/error', () => {
    return HttpResponse.json({ error: 'Test error' }, { status: 400 });
  }),
  
  // Handler for testing POST requests
  http.post('https://api.example.com/submit', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ received: body });
  }),
  
  // Handler for testing query parameters
  http.get('https://api.example.com/query', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({ params: Object.fromEntries(url.searchParams) });
  }),
  
  // Handler for testing headers
  http.get('https://api.example.com/headers', ({ request }) => {
    return HttpResponse.json({ 
      headers: {
        'x-custom-header': request.headers.get('x-custom-header'),
        'content-type': request.headers.get('content-type')
      }
    });
  }),
  
  // Handler for testing empty responses
  http.get('https://api.example.com/empty', () => {
    return new HttpResponse(null, { status: 204 });
  })
);

// Start server before all tests
beforeAll(() => server.listen());
// Reset handlers after each test
afterEach(() => server.resetHandlers());
// Close server after all tests
afterAll(() => server.close());

describe('HttpClient', () => {
  it('should create a client with the factory function', () => {
    const client = createHttpClient({ apiEndpoint: 'https://api.example.com' });
    expect(client).toBeInstanceOf(HttpClient);
  });
  
  it('should make successful GET requests', async () => {
    const client = createHttpClient({ apiEndpoint: 'https://api.example.com' });
    const response = await client.fetch('GET', '/test');
    
    expect(response).toEqual({ success: true, data: 'test data' });
  });
  
  it('should throw MendError on failed requests', async () => {
    const client = createHttpClient({ apiEndpoint: 'https://api.example.com' });
    
    await expect(client.fetch('GET', '/error')).rejects.toThrow(MendError);
    
    try {
      await client.fetch('GET', '/error');
    } catch (error) {
      expect(error).toBeInstanceOf(MendError);
      expect((error as MendError).status).toBe(400);
    }
  });
  
  it('should send body data with POST requests', async () => {
    const client = createHttpClient({ apiEndpoint: 'https://api.example.com' });
    const testData = { name: 'Test User', age: 30 };
    
    const response = await client.fetch('POST', '/submit', testData);
    expect(response).toEqual({ received: testData });
  });
  
  it('should handle query parameters correctly', async () => {
    const client = createHttpClient({ apiEndpoint: 'https://api.example.com' });
    const query = { page: 1, limit: 10, search: 'test query' };
    
    const response = await client.fetch('GET', '/query', undefined, query);
    expect(response).toEqual({ 
      params: { 
        page: '1',
        limit: '10',
        search: 'test query'
      } 
    });
  });
  
  it('should include default and custom headers', async () => {
    const client = createHttpClient({ 
      apiEndpoint: 'https://api.example.com',
      defaultHeaders: { 'x-client-id': 'test-client' }
    });
    
    const response = await client.fetch(
      'GET', 
      '/headers', 
      undefined, 
      {}, 
      { 'x-custom-header': 'custom-value' }
    );
    
    expect(response).toHaveProperty('headers');
    expect((response as any).headers['x-custom-header']).toBe('custom-value');
  });
  
  it('should handle empty responses', async () => {
    const client = createHttpClient({ apiEndpoint: 'https://api.example.com' });
    const response = await client.fetch('GET', '/empty');
    
    expect(response).toBeUndefined();
  });
});
