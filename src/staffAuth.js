// Staff session helpers. The session lives in sessionStorage, so it ends when the tab is closed.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const KEY = 'qf_staff_session';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function logout() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function login(username, password) {
  const res = await fetch(`${API_URL}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 429 ? 'Too many attempts. Wait a minute and try again.' : body.message || 'Sign in failed');
  const session = { token: body.token, user: body.user };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

// fetch() to your API with the signed-in staff member's token attached.
export async function authFetch(path, options = {}) {
  const session = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${session?.token || ''}`,
    },
  });
  if (res.status === 401) logout(); // expired or removed account
  return res;
}
