// Central HTTP client for all backend requests.

const BASE_URL = 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      data.message || `Request failed with status ${res.status}`,
      res.status,
      data
    );
  }

  return data;
}

export function createClient(getToken) {
  return {
    get: (path) => getToken().then(t => request('GET', path, null, t)),
    post: (path, body) => getToken().then(t => request('POST', path, body, t)),
    delete: (path) => getToken().then(t => request('DELETE', path, null, t)),
  };
}

export { ApiError };
