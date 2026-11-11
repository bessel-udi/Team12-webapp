import { useCallback, useEffect, useState } from 'react';
import ProviderInventory from './ProviderInventory';
import { authFetch, getSession, login, logout } from '../staffAuth';

const box = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '1.25rem',
  marginTop: '1rem',
  boxShadow: 'var(--shadow)',
};
const input = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' };
const button = { padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' };
const label = { display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '8px' };

function LoginForm({ onDone, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await login(username, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section style={{ ...box, maxWidth: '360px' }}>
      <h3 style={{ color: 'var(--heading)', marginBottom: '0.75rem' }}>Staff sign in</h3>
      <form onSubmit={submit}>
        <label style={label}>
          Username
          <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label style={label}>
          Password
          <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p style={{ color: 'var(--primary)', fontSize: '13px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" style={button} disabled={busy || !username || !password}>Sign in</button>
          <button type="button" style={button} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

// Admin only: add staff accounts and see who took what.
function AdminTools({ refreshKey, onSignedOut }) {
  const [activity, setActivity] = useState([]);
  const [form, setForm] = useState({ username: '', displayName: '', role: 'fundi', password: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    authFetch('/staff/activity')
      .then(async (res) => {
        if (res.status === 401) {
          onSignedOut();
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setActivity(body.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey, onSignedOut]);

  async function addStaff(e) {
    e.preventDefault();
    setMsg('');
    try {
      const res = await authFetch('/staff', { method: 'POST', body: JSON.stringify(form) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Created ${body.user.role} "${body.user.username}".`);
        setForm({ ...form, username: '', displayName: '', password: '' });
      } else {
        setMsg(body.message || 'Could not create the account');
      }
    } catch {
      setMsg('Could not reach the server');
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section style={box}>
      <h3 style={{ color: 'var(--heading)', marginBottom: '0.75rem' }}>Admin</h3>

      <h4 style={{ color: 'var(--heading)', margin: '0 0 8px' }}>Add a staff account</h4>
      <form onSubmit={addStaff} style={{ maxWidth: '360px' }}>
        <label style={label}>Username<input style={input} value={form.username} onChange={set('username')} autoComplete="off" /></label>
        <label style={label}>Full name<input style={input} value={form.displayName} onChange={set('displayName')} autoComplete="off" /></label>
        <label style={label}>
          Role
          <select style={input} value={form.role} onChange={set('role')}>
            <option value="fundi">Fundi</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label style={label}>Password (8+ characters)<input style={input} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /></label>
        <button type="submit" style={button}>Create account</button>
        {msg && <p style={{ fontSize: '13px', color: 'var(--text)' }}>{msg}</p>}
      </form>

      <h4 style={{ color: 'var(--heading)', margin: '16px 0 8px' }}>Recent activity</h4>
      {activity.length === 0 && <p style={{ color: 'var(--text)', fontSize: '13px' }}>Nothing yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text)' }}>
        {activity.map((a) => (
          <li key={a.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            {a.who} {a.quantity > 0 ? 'took' : 'returned'} {Math.abs(a.quantity)} × {a.product_name || `item #${a.product_id}`} ·{' '}
            {new Date(a.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Put this where the materials card used to be. Customers only ever see a small "Staff sign in" link.
export default function StaffAccess({ providerId }) {
  const [session, setSession] = useState(getSession);
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState(0);

  const handleSignOut = useCallback(() => {
    logout();
    setSession(null);
    setOpen(false);
  }, []);
  const handleChanged = useCallback(() => setChanges((c) => c + 1), []);

  if (!session) {
    if (open) return <LoginForm onDone={setSession} onCancel={() => setOpen(false)} />;
    return (
      <p style={{ marginTop: '1.5rem', fontSize: '13px' }}>
        <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text)', textDecoration: 'underline', cursor: 'pointer' }}>
          Staff sign in
        </button>
      </p>
    );
  }

  return (
    <>
      <div style={{ marginTop: '1.5rem', fontSize: '13px', color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Signed in as <strong>{session.user.name}</strong> ({session.user.role})</span>
        <button type="button" style={button} onClick={handleSignOut}>Sign out</button>
      </div>
      <ProviderInventory providerId={providerId} user={session.user} onSignedOut={handleSignOut} onChanged={handleChanged} />
      {session.user.role === 'admin' && <AdminTools refreshKey={changes} onSignedOut={handleSignOut} />}
    </>
  );
}
