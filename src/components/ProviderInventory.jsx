import { useEffect, useState } from 'react';

// Your own server, not the partner. The partner's API key never reaches this file.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Needed only for taking/returning items (those routes require a key).
const API_KEY = import.meta.env.VITE_API_KEY || '';

const STATUS = {
  in_stock: { label: 'In stock', color: '#166534' },
  low_stock: { label: 'Low stock', color: '#b45309' },
  out_of_stock: { label: 'Out of stock', color: 'var(--primary)' },
};

function ItemRow({ item, providerId, takenBy, canEdit, onUpdated }) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = STATUS[item.status] || STATUS.out_of_stock;

  const maxTake = item.quantity;
  const safeQty = Math.max(1, qty);

  async function act(action) {
    if (!takenBy.trim()) {
      setError('Enter your name first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/provider-inventory/${providerId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          productId: item.product_id,
          quantity: safeQty,
          takenBy: takenBy.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Request failed');
      onUpdated(body);
      setQty(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const btn = (enabled) => ({
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.5,
  });

  return (
    <li
      style={{
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <span>
          <strong>{item.name}</strong>
          <br />
          <small>
            {item.category} · Available: {item.quantity}
            {item.taken > 0 && ` · Taken by fundis: ${item.taken}`}
          </small>
        </span>
        <strong style={{ color: s.color, whiteSpace: 'nowrap' }}>{s.label}</strong>
      </div>

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={btn(!busy && qty > 1)} disabled={busy || qty <= 1} onClick={() => setQty(safeQty - 1)}>−</button>
          <span style={{ minWidth: '1.5rem', textAlign: 'center' }}>{safeQty}</span>
          <button type="button" style={btn(!busy && safeQty < Math.max(maxTake, item.taken))} disabled={busy || safeQty >= Math.max(maxTake, item.taken)} onClick={() => setQty(safeQty + 1)}>+</button>
          <button type="button" style={btn(!busy && maxTake >= safeQty)} disabled={busy || maxTake < safeQty} onClick={() => act('take')}>
            Take
          </button>
          <button type="button" style={btn(!busy && item.taken >= safeQty)} disabled={busy || item.taken < safeQty} onClick={() => act('return')}>
            Return
          </button>
        </div>
      )}

      {error && <p style={{ color: 'var(--primary)', fontSize: '13px', margin: '6px 0 0' }}>{error}</p>}
    </li>
  );
}

function ProviderInventory({ providerId, takenBy: defaultName = '' }) {
  const [state, setState] = useState({ status: 'loading', items: [], stale: false });
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/provider-inventory/${providerId}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setState({ status: 'notfound', items: [], stale: false });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', items: [], stale: false });
          return;
        }
        const result = await res.json();
        if (!Array.isArray(result.data)) throw new Error('Invalid inventory response');
        setState({ status: 'ok', items: result.data, stale: result.stale === true });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ status: 'error', items: [], stale: false });
      });

    return () => controller.abort();
  }, [providerId]);

  // After a take/return the server sends back the whole updated list.
  function handleUpdated(body) {
    setState({ status: 'ok', items: body.data, stale: body.stale === true });
  }

  const canEdit = Boolean(API_KEY) && !state.stale;

  const boxStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
    marginTop: '1.5rem',
    boxShadow: 'var(--shadow)',
  };

  return (
    <section style={boxStyle}>
      <h3 style={{ color: 'var(--heading)', marginBottom: '0.75rem' }}>Materials in stock</h3>

      {state.status === 'loading' && <p style={{ color: 'var(--text)' }}>Loading inventory...</p>}

      {state.status === 'error' && (
        <p style={{ color: 'var(--primary)' }}>Inventory is unavailable right now. Please try again later.</p>
      )}

      {state.status === 'notfound' && (
        <p style={{ color: 'var(--text)' }}>No inventory found for this provider.</p>
      )}

      {state.status === 'ok' && (
        <>
          {state.stale && (
            <p style={{ color: '#b45309', fontSize: '13px' }}>
              Showing previously saved inventory. Live data is temporarily unavailable, so items can't be taken right now.
            </p>
          )}

          {!API_KEY && (
            <p style={{ color: 'var(--text)', fontSize: '13px' }}>
              View only: set VITE_API_KEY to enable taking and returning materials.
            </p>
          )}

          {canEdit && (
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '13px', color: 'var(--text)' }}>
                Your name{' '}
                <input
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. James Otieno"
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
              </label>
            </div>
          )}

          {state.items.length === 0 && <p style={{ color: 'var(--text)' }}>No items listed yet.</p>}

          {state.items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {state.items.map((item) => (
                <ItemRow
                  key={item.product_id}
                  item={item}
                  providerId={providerId}
                  takenBy={name}
                  canEdit={canEdit}
                  onUpdated={handleUpdated}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default ProviderInventory;
