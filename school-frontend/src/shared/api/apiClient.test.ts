import { API, http, HttpResponse, problem, server, STUDENT } from '../../test/server';
import { api } from './apiClient';
import { ApiError } from './errors';

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the request to fail, but it succeeded.');
}

describe('apiClient', () => {
  it('returns the JSON body of a successful response', async () => {
    server.use(http.get(`${API}/classes`, () => HttpResponse.json([{ id: 'c-1' }])));

    await expect(api.get('/classes')).resolves.toEqual([{ id: 'c-1' }]);
  });

  it('sends the student ID as X-Student-Id when there is one, and no header when there is not', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${API}/me/holds`, ({ request }) => {
        seen.push(request.headers.get('X-Student-Id'));
        return HttpResponse.json([]);
      }),
    );

    await api.get('/me/holds', STUDENT);
    await api.get('/me/holds', null);

    expect(seen).toEqual([STUDENT, null]);
  });

  it('sends a JSON body on POST', async () => {
    let received: unknown;
    server.use(
      http.post(`${API}/classes`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: 'c-9', name: 'A', totalSeats: 3 }, { status: 201 });
      }),
    );

    await api.post('/classes', { body: { name: 'A', totalSeats: 3 } });

    expect(received).toEqual({ name: 'A', totalSeats: 3 });
  });

  it('handles 204 No Content without trying to parse a body', async () => {
    server.use(http.delete(`${API}/holds/h-1`, () => new HttpResponse(null, { status: 204 })));

    await expect(api.delete('/holds/h-1', STUDENT)).resolves.toBeUndefined();
  });

  it('turns a ProblemDetails refusal into an ApiError carrying the backend code', async () => {
    server.use(http.post(`${API}/classes/c-1/holds`, () => problem(409, 'SEATS_FULL', 'No seats are available.')));

    const error = await failure(api.post('/classes/c-1/holds', { studentId: STUDENT }));

    expect(error.code).toBe('SEATS_FULL');
    expect(error.status).toBe(409);
    expect(error.detail).toBe('No seats are available.');
    expect(error.message).toBe('No seats are left in this class.');
  });

  it('reports a stopped server as unreachable instead of throwing a raw TypeError', async () => {
    // WHY: with the backend down, fetch rejects with "Failed to fetch". The user must see
    // a sentence, and the UI must be able to tell this case apart from a refusal.
    server.use(http.get(`${API}/classes`, () => HttpResponse.error()));

    const error = await failure(api.get('/classes'));

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Server unreachable, please try again.');
  });

  it('treats a 5xx as unreachable, even when its body carries a code', async () => {
    server.use(http.get(`${API}/classes`, () => problem(500, 'INTERNAL_ERROR')));

    const error = await failure(api.get('/classes'));

    expect(error.code).toBe('SERVER_ERROR');
    expect(error.message).toBe('Server unreachable, please try again.');
  });

  it('copes with an error page that is not JSON', async () => {
    server.use(
      http.get(`${API}/classes`, () =>
        new HttpResponse('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const error = await failure(api.get('/classes'));

    expect(error.code).toBe('SERVER_ERROR');
    expect(error.status).toBe(502);
  });

  it('calls the URL from the runtime config, so it can change without a rebuild', async () => {
    // WHY: /config.js is written when the container starts. The bundle must obey it.
    window.__APP_CONFIG__ = { apiUrl: 'http://school.example:9000/' };
    server.use(http.get('http://school.example:9000/classes', () => HttpResponse.json(['from the configured host'])));

    await expect(api.get('/classes')).resolves.toEqual(['from the configured host']);
  });
});
