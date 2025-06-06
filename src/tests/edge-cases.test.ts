import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MendSdk from '../lib/index';
import { ERROR_CODES } from '../lib/errors';

const server = setupServer(
  http.post('https://api.example.com/session', () =>
    HttpResponse.json({ token: 'tok', payload: { orgs: [{ id: 1 }] } }),
  ),
  http.put('https://api.example.com/session/org/:orgId', () =>
    HttpResponse.json({ payload: { org_id: 1 } }),
  ),
  http.post('https://api.example.com/patient', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.name) {
      return HttpResponse.json({ message: 'Name required' }, { status: 400 });
    }
    return HttpResponse.json({ payload: { id: 1, name: body.name } });
  }),
  http.put('https://api.example.com/patient/:id', async ({ params, request }) => {
    const { id } = params;
    if (id !== '1') {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ payload: { id: Number(id), ...body } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API edge cases', () => {
  it('throws when required fields are missing on createPatient', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'e',
      password: 'p',
      orgId: 1,
    });

    await expect(sdk.createPatient({} as Record<string, unknown>)).rejects.toMatchObject({
      status: 400,
      code: ERROR_CODES.HTTP_ERROR,
    });
  });

  it('throws when updating a non-existent patient', async () => {
    const sdk = new MendSdk({
      apiEndpoint: 'https://api.example.com',
      email: 'e',
      password: 'p',
      orgId: 1,
    });

    await expect(sdk.updatePatient(999, { name: 'x' })).rejects.toMatchObject({
      status: 404,
      code: ERROR_CODES.HTTP_ERROR,
    });
  });
});
