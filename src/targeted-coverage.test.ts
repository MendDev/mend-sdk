import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from './index';

// Simple server with minimal handlers
const server = setupServer(
  // Auth endpoints
  http.post('https://api.example.com/session', () => {
    return HttpResponse.json({ 
      token: 'fake-jwt-token', 
      payload: { 
        orgs: [{ id: 123, name: 'Test Organization' }] 
      } 
    });
  }),
  
  // For org switching
  http.put('https://api.example.com/session/org/:orgId', ({ params }) => {
    return HttpResponse.json({ payload: { org_id: Number(params.orgId) } });
  }),
  
  // For basic requests
  http.get('https://api.example.com/user/1', () => {
    return HttpResponse.json({ payload: { id: 1, name: 'Test User' } });
  }),
  
  // For patient methods
  http.get('https://api.example.com/patient', () => {
    return HttpResponse.json({ payload: [{ id: 1, name: 'Test Patient' }] });
  }),
  http.get('https://api.example.com/patient/1', () => {
    return HttpResponse.json({ payload: { id: 1, name: 'Test Patient' } });
  }),
  http.post('https://api.example.com/patient', () => {
    return HttpResponse.json({ payload: { id: 2, name: 'New Patient' } });
  }),
  http.put('https://api.example.com/patient/1', () => {
    return HttpResponse.json({ payload: { id: 1, name: 'Updated Patient' } });
  }),
  http.delete('https://api.example.com/patient/1', () => {
    return HttpResponse.json({ payload: { success: true } });
  }),
  
  // For property methods
  http.get('https://api.example.com/property', () => {
    return HttpResponse.json({ payload: { properties: { test_key: 'test_value' } } });
  }),
  http.get('https://api.example.com/property/test_key', () => {
    return HttpResponse.json({ payload: 'test_value' });
  }),
  
  // For appointment methods
  http.get('https://api.example.com/appointment/1', () => {
    return HttpResponse.json({ payload: { id: 1, patient_id: 1 } });
  }),
  http.post('https://api.example.com/appointment', () => {
    return HttpResponse.json({ payload: { id: 2, patient_id: 1 } });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('Direct Tests for Uncovered Lines in index.ts', () => {
  // Test lines 90-130: request method and ensureAuth
  it('should make a request after ensuring authentication', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      orgId: 123
    });
    
    const result = await sdk.request('GET', '/user/1');
    expect(result).toBeDefined();
  });
  
  // Test lines 172-194: Patient methods
  describe('Patient Methods (lines 172-194)', () => {
    let sdk: MendSdk;
    
    beforeEach(() => {
      sdk = new MendSdk({
        apiEndpoint: 'https://api.example.com',
        email: 'test@example.com',
        password: 'password123',
        orgId: 123
      });
    });
    
    it('should search patients', async () => {
      const result = await sdk.searchPatients({ name: 'Test' });
      expect(result).toBeDefined();
    });
    
    it('should get patient details', async () => {
      const result = await sdk.getPatient(1);
      expect(result).toBeDefined();
    });
    
    it('should create a patient', async () => {
      const result = await sdk.createPatient({ name: 'New Patient' });
      expect(result).toBeDefined();
    });
    

    
    it('should update a patient', async () => {
      const result = await sdk.updatePatient(1, { name: 'Updated Patient' });
      expect(result).toBeDefined();
    });
    
    it('should delete a patient', async () => {
      const result = await sdk.deletePatient(1);
      expect(result).toBeDefined();
    });
  });
  
  // Test lines 205-230: Appointment methods
  describe('Appointment Methods (lines 205-230)', () => {
    let sdk: MendSdk;
    
    beforeEach(() => {
      sdk = new MendSdk({
        apiEndpoint: 'https://api.example.com',
        email: 'test@example.com',
        password: 'password123',
        orgId: 123
      });
    });
    
    it('should get appointment details', async () => {
      const result = await sdk.getAppointment(1);
      expect(result).toBeDefined();
    });
    
    it('should create an appointment', async () => {
      const result = await sdk.createAppointment({ patient_id: 1, time: '2023-01-01T12:00:00Z' });
      expect(result).toBeDefined();
    });
  });
  
  // Test lines 240-278: Property methods
  describe('Property Methods (lines 240-278)', () => {
    let sdk: MendSdk;
    
    beforeEach(() => {
      sdk = new MendSdk({
        apiEndpoint: 'https://api.example.com',
        email: 'test@example.com',
        password: 'password123',
        orgId: 123
      });
    });
    
    it('should get all properties', async () => {
      const result = await sdk.getProperties();
      expect(result).toBeDefined();
    });
    
    it('should get a specific property', async () => {
      const result = await sdk.getProperty('test_key');
      expect(result).toBe('test_value');
    });
  });
});
