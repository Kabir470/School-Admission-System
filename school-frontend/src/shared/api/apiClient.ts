import { getApiUrl } from './config';
import { ApiError, NETWORK_ERROR, SERVER_ERROR } from './errors';

export const STUDENT_ID_HEADER = 'X-Student-Id';

interface RequestOptions {
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as the X-Student-Id header: the student's identity. */
  studentId?: string | null;
}

/**
 * The single door to the backend. It never returns a failure: any problem — the server
 * being down, a 5xx, a refusal such as "seats full" — is thrown as an ApiError carrying
 * a code that the UI maps to a readable message.
 */
async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.studentId) {
    headers[STUDENT_ID_HEADER] = options.studentId;
  }

  let response: Response;
  try {
    response = await fetch(getApiUrl() + path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    // fetch rejects when there is no answer at all: server stopped, offline, DNS, CORS.
    throw new ApiError(NETWORK_ERROR, 0);
  }

  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(SERVER_ERROR, response.status);
    }
  }

  throw await toApiError(response);
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: { code?: unknown; detail?: unknown } | null = null;
  try {
    problem = (await response.json()) as { code?: unknown; detail?: unknown };
  } catch {
    // Not JSON: for example an HTML error page from a proxy in front of a dead backend.
  }

  const code = typeof problem?.code === 'string' ? problem.code : null;
  const detail = typeof problem?.detail === 'string' ? problem.detail : undefined;

  if (response.status >= 500 || code === null) {
    return new ApiError(SERVER_ERROR, response.status, detail);
  }

  return new ApiError(code, response.status, detail);
}

export const api = {
  get: <T>(path: string, studentId?: string | null) => request<T>('GET', path, { studentId }),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  delete: (path: string, studentId?: string | null) => request<void>('DELETE', path, { studentId }),
};
