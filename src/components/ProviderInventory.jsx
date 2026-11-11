import { useEffect, useState } from 'react';
import { authFetch } from '../staffAuth';

// Staff-only card. The parent (StaffAccess) only renders it after sign-in, and the server
// refuses anyone who is not a signed-in admin or fundi.

const STATUS = {
  in_stock: { label: 'In stock', color: '#166534' },
  low_stock: { label: 'Low stock', color: '#b45309' },
  out_of_stock: { label: 'Out of stock', color: 'var(--primary)' },
};

function ItemRow({ item, providerId, user, onUpdated, onSignedOut }) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = STATUS[item.status] || STATUS.out_of_stock;

  const safeQty = Math.max(1, qty);
  const returnable = user.role === 'admin' ? item.taken : item.mine;
  const maxQty = Math.max(item.quantity, returnable, 1);

  async function act(action) {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/provider-inventory/${providerId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ productId: item.product_id, quantity: safeQty }),
      });
      if (res.status === 401) {
        onSignedOut();
        return;
      }
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

  const canTake = !busy && item.quantity >= safeQty;
  const canReturn = !busy && returnable >= safeQty;

  return (
    <li style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <span>
          <strong>{item.name}</strong>
          <br />
          <small>
            {item.category} · Available: {item.quantity}
            {item.taken > 0 && ` · Held by staff: ${item.taken}`}
            {item.mine > 0 && ` · You hold: ${item.mine}`}
          </small>
        </span>
        <strong style={{ color: s.color, whiteSpace: 'nowrap' }}>{s.label}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        <button type="button" style={btn(!busy && qty > 1)} disabled={busy || qty <= 1} onClick={() => setQty(safeQty - 1)}>−</button>
        <span style={{ minWidth: '1.5rem', textAlign: 'center' }}>{safeQty}</span>
        <button type="button" style={btn(!busy && safeQty < maxQty)} disabled={busy || safeQty >= maxQty} onClick={() => setQty(safeQty + 1)}>+</button>
        <button type="button" style={btn(canTake)} disabled={!canTake} onClick={() => act('take')}>Take</button>
        <button type="button" style={btn(canReturn)} disabled={!canReturn} onClick={() => act('return')}>Return</button>
      </div>

      {error && <p style={{ color: 'var(--primary)', fontSize: '13px', margin: '6px 0 0' }}>{error}</p>}
    </li>
  );
}

function ProviderInventory({ providerId, user, onSignedOut, onChanged }) {
  const [state, setState] = useState({ status: 'loading', items: [], stale: false });

  useEffect(() => {
    const controller = new AbortController();

    authFetch(`/provider-inventory/${providerId}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401) {
          onSignedOut();
          return;
        }
        if (res.status === 403) {
          setState({ status: 'forbidden', items: [], stale: false });
          return;
        }
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
  }, [providerId, onSignedOut]);

  // After a take/return the server sends back the whole updated list.
  function handleUpdated(body) {
    setState({ status: 'ok', items: body.data, stale: body.stale === true });
    if (onChanged) onChanged();
  }

  const boxStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
    marginTop: '1rem',
    boxShadow: 'var(--shadow)',
  };

  return (
    <section style={boxStyle}>
      <h3 style={{ color: 'var(--heading)', marginBottom: '0.75rem' }}>Materials in stock</h3>

      {state.status === 'loading' && <p style={{ color: 'var(--text)' }}>Loading inventory...</p>}
      {state.status === 'error' && (
        <p style={{ color: 'var(--primary)' }}>Inventory is unavailable right now. Please try again later.</p>
      )}
      {state.status === 'forbidden' && <p style={{ color: 'var(--primary)' }}>Your account does not have access to this.</p>}
      {state.status === 'notfound' && <p style={{ color: 'var(--text)' }}>No inventory found for this provider.</p>}

      {state.status === 'ok' && (
        <>
          {state.stale && (
            <p style={{ color: '#b45309', fontSize: '13px' }}>
              Showing previously saved inventory. Live data is temporarily unavailable, so items can't be taken right now.
            </p>
          )}
          {state.items.length === 0 && <p style={{ color: 'var(--text)' }}>No items listed yet.</p>}
          {state.items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {state.items.map((item) => (
                <ItemRow
                  key={item.product_id}
                  item={item}
                  providerId={providerId}
                  user={user}
                  onUpdated={handleUpdated}
                  onSignedOut={onSignedOut}
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
