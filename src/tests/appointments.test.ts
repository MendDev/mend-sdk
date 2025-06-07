import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';
import { AppointmentPayload } from '../lib/types';
import { MendError, ERROR_CODES } from '../lib/errors';

// Setup MSW server with dedicated handlers for appointment tests
const server = setupServer(
  // Authentication endpoints
  http.post('https://api.example.com/session', () => {
    return HttpResponse.json({
      token: 'fake-jwt-token',
      payload: { orgs: [{ id: 123, name: 'Test Organization' }] },
    });
  }),

  http.put('https://api.example.com/session/org/:orgId', ({ params }) => {
    const { orgId } = params;
    return HttpResponse.json({ payload: { org_id: Number(orgId) } });
  }),

  // Property endpoint - returns all properties
  http.get('https://api.example.com/property', () => {
    return HttpResponse.json({
      payload: {
        properties: {
          'scheduling.patients.autoApprove': 1,
          'some.other.property': 'value',
        },
      },
    });
  }),

  // Handle unknown properties with 404

  // Appointment endpoints
  http.get('https://api.example.com/appointment/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      payload: {
        id: Number(id),
        patientId: 1,
        providerId: 2,
        appointmentTypeId: 3,
        startDate: '2025-06-10T09:00:00Z',
        endDate: '2025-06-10T09:30:00Z',
      },
    });
  }),

  http.post('https://api.example.com/appointment', async ({ request }) => {
    const body = (await request.json()) as Record<string, any>;
    return HttpResponse.json({
      payload: {
        id: 42,
        ...body,
      },
    });
  }),

  http.get('https://api.example.com/appointment/available-slots', ({ request }) => {
    const url = new URL(request.url);
    const providerId = url.searchParams.get('providerId');
    const appointmentTypeId = url.searchParams.get('appointmentTypeId');

    if (providerId && appointmentTypeId) {
      return HttpResponse.json({
        payload: [
          {
            startDate: '2025-06-10T09:00:00Z',
            endDate: '2025-06-10T09:30:00Z',
            providerId: Number(providerId),
            appointmentTypeId: Number(appointmentTypeId),
          },
          {
            startDate: '2025-06-10T10:00:00Z',
            endDate: '2025-06-10T10:30:00Z',
            providerId: Number(providerId),
            appointmentTypeId: Number(appointmentTypeId),
          },
        ],
      });
    }

    return HttpResponse.json({ payload: [] });
  }),

  http.get('https://api.example.com/appointment-type/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      payload: {
        id: Number(id),
        name: 'Test Appointment Type',
        durationMinutes: 30,
      },
    });
  }),
);

describe('Appointment API helpers', () => {
  let sdk: MendSdk;

  beforeAll(() => {
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'test@example.com',
      password: 'password123',
      orgId: 123,
    });
  });

  describe('getAppointment', () => {
    it('should fetch appointment by ID', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.getAppointment(42);

      expect(requestSpy).toHaveBeenCalledWith(
        'GET',
        '/appointment/42',
        undefined,
        undefined,
        undefined,
      );
      expect(result.payload).toMatchObject({
        id: 42,
        patientId: 1,
        providerId: 2,
      });
    });
  });

  describe('createAppointment', () => {
    it('should create an appointment with required fields', async () => {
      const appointmentData: AppointmentPayload = {
        patientId: 1,
        providerId: 2,
        appointmentTypeId: 3,
        startDate: '2025-06-10T09:00:00Z',
        endDate: '2025-06-10T09:30:00Z',
      };

      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.createAppointment(appointmentData);

      // Get the actual call count to help with debugging
      const callCount = requestSpy.mock.calls.length;

      // Find the appointment creation call (the last call should be the POST to /appointment)
      let appointmentCallIndex = -1;
      for (let i = 0; i < callCount; i++) {
        const call = requestSpy.mock.calls[i];
        if (call[0] === 'POST' && call[1] === '/appointment') {
          appointmentCallIndex = i + 1; // +1 because nth-call is 1-indexed
          break;
        }
      }

      expect(appointmentCallIndex).toBeGreaterThan(0);

      // Verify the appointment creation call with the correct payload
      expect(requestSpy).toHaveBeenNthCalledWith(
        appointmentCallIndex,
        'POST',
        '/appointment',
        expect.objectContaining({
          optimized: 1,
          patientId: 1,
          providerId: 2,
          appointmentTypeId: 3,
          startDate: '2025-06-10T09:00:00Z',
          endDate: '2025-06-10T09:30:00Z',
          approved: 1, // Auto-injected from property
        }),
        undefined,
        undefined,
      );
    });

    it('should create an appointment with optional fields', async () => {
      const appointmentData: AppointmentPayload = {
        patientId: 1,
        providerId: 2,
        appointmentTypeId: 3,
        startDate: '2025-06-10T09:00:00Z',
        endDate: '2025-06-10T09:30:00Z',
        notify: true,
        approved: 0, // Override auto-approved
        wardId: 5,
        symptoms: [{ content: 'Fever' }],
      };

      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.createAppointment(appointmentData);

      // Find the appointment creation call (should be a POST to /appointment)
      let appointmentCallIndex = -1;
      const callCount = requestSpy.mock.calls.length;

      for (let i = 0; i < callCount; i++) {
        const call = requestSpy.mock.calls[i];
        if (call[0] === 'POST' && call[1] === '/appointment') {
          appointmentCallIndex = i + 1; // +1 because nth-call is 1-indexed
          break;
        }
      }

      expect(appointmentCallIndex).toBeGreaterThan(0);

      // Verify appointment creation with correct payload including overridden approved value
      expect(requestSpy).toHaveBeenNthCalledWith(
        appointmentCallIndex,
        'POST',
        '/appointment',
        expect.objectContaining({
          optimized: 1,
          patientId: 1,
          providerId: 2,
          appointmentTypeId: 3,
          startDate: '2025-06-10T09:00:00Z',
          endDate: '2025-06-10T09:30:00Z',
          notify: true,
          approved: 0, // User's value preserved
          wardId: 5,
          symptoms: [{ content: 'Fever' }],
        }),
        undefined,
        undefined,
      );
    });

    it('should throw error with missing required fields', async () => {
      const appointmentData = {
        patientId: 1,
        // Missing providerId
        appointmentTypeId: 3,
        startDate: '2025-06-10T09:00:00Z',
        // Missing endDate
      } as AppointmentPayload;

      await expect(sdk.createAppointment(appointmentData)).rejects.toThrow(MendError);
      await expect(sdk.createAppointment(appointmentData)).rejects.toThrow(
        'Missing required fields',
      );
    });
  });

  describe('listAvailableSlots', () => {
    it('should fetch available slots with required parameters', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.listAvailableSlots(2, 3, '2025-06-10');

      expect(requestSpy).toHaveBeenCalledWith(
        'GET',
        '/appointment/available-slots',
        undefined,
        {
          providerId: 2,
          appointmentTypeId: 3,
          startDate: '2025-06-10',
          limit: 10, // Default value
        },
        undefined,
      );
    });

    it('should fetch available slots with custom limit', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.listAvailableSlots(2, 3, '2025-06-10', 20);

      expect(requestSpy).toHaveBeenCalledWith(
        'GET',
        '/appointment/available-slots',
        undefined,
        {
          providerId: 2,
          appointmentTypeId: 3,
          startDate: '2025-06-10',
          limit: 20,
        },
        undefined,
      );
    });
  });

  describe('getAppointmentType', () => {
    it('should fetch appointment type details by ID', async () => {
      const requestSpy = vi.spyOn(sdk, 'request' as any);
      const result = await sdk.getAppointmentType(3);

      expect(requestSpy).toHaveBeenCalledWith(
        'GET',
        '/appointment-type/3',
        undefined,
        undefined,
        undefined,
      );
      expect(result.payload).toMatchObject({
        id: 3,
        name: 'Test Appointment Type',
        durationMinutes: 30,
      });
    });
  });
});
