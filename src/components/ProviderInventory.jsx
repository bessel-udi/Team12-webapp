import { useEffect, useState } from 'react';

// Your own server, not the partner. The partner's key never reaches this file.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function ProviderInventory({ providerId }) {
  const [state, setState] = useState({ status: 'loading', items: [] });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', items: [] });

    fetch(`${API_URL}/provider-inventory/${providerId}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setState({ status: 'notfound', items: [] });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', items: [] });
          return;
        }
        const items = await res.json();
        setState({ status: 'ok', items });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setState({ status: 'error', items: [] });
        }
      });

    return () => controller.abort();
  }, [providerId]);

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
      <h3 style={{ color: 'var(--heading)', marginBottom: '0.75rem' }}>
        Materials in stock
      </h3>

      {state.status === 'loading' && (
        <p style={{ color: 'var(--text)' }}>Loading inventory...</p>
      )}

      {state.status === 'error' && (
        <p style={{ color: 'var(--primary)' }}>
          Inventory is unavailable right now. Please try again later.
        </p>
      )}

      {state.status === 'notfound' && (
        <p style={{ color: 'var(--text)' }}>No inventory found for this provider.</p>
      )}

      {state.status === 'ok' && state.items.length === 0 && (
        <p style={{ color: 'var(--text)' }}>No items listed yet.</p>
      )}

      {state.status === 'ok' && state.items.length > 0 && (
        <ul style={{ listStyle: 'none' }}>
          {state.items.map((item) => (
            <li
              key={item.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <span>
                {item.name} ({item.quantity} {item.unit})
              </span>
              <strong
                style={{
                  color: item.status === 'in_stock' ? '#166534' : 'var(--primary)',
                }}
              >
                {item.status === 'in_stock' ? 'In stock' : 'Out of stock'}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ProviderInventory;
