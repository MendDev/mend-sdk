import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupMswServer, createTestSdk } from './utils/test-utils';

const sampleSession = (id: number, completed: boolean, reviewed: boolean) => ({
  id,
  assessmentType_name: 'PHQ-2',
  completed: completed ? '2025-01-01' : null,
  reviewed: reviewed ? '2025-01-02' : null,
});

const server = setupMswServer([
  http.get('https://api.example.com/assessment-session', ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    // respond with sessions based on query for simple test
    const out: any[] = [];
    if (params.completed === 'NULL') out.push(sampleSession(1, false, false));
    else if (params.reviewed === 'NULL') out.push(sampleSession(2, true, false));
    else out.push(sampleSession(3, true, true));

    return HttpResponse.json({ payload: { sessions: out, page: 1, totalPages: 1, limit: 25, totalItems: out.length } });
  }),
  http.get('https://api.example.com/assessment-session/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({ payload: { session: sampleSession(Number(id), true, true) } });
  }),
]);

afterEach(() => server.resetHandlers());

describe('Assessment helpers', () => {
  const sdk = createTestSdk();

  it('should get outstanding', async () => {
    const res = await sdk.listAssessmentSessions({ activeSubjectIds: 1, status: 'outstanding' });
    expect(res.payload.sessions[0].completed).toBeNull();
  });

  it('should get awaiting review', async () => {
    const res = await sdk.listAssessmentSessions({ activeSubjectIds: [1, 2], status: 'awaitingReview' });
    expect(res.payload.sessions[0].reviewed).toBeNull();
  });

  it('should get detail', async () => {
    const res = await sdk.getAssessmentSession(99);
    expect(res.payload.session.id).toBe(99);
  });
});
