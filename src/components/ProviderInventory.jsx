
import { useEffect, useState } from 'react';

// Your own server, not the partner.
// The partner's API key never reaches this file.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function ProviderInventory({ providerId }) {
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    stale: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/provider-inventory/${providerId}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          setState({
            status: 'notfound',
            items: [],
            stale: false,
          });
          return;
        }

        if (!res.ok) {
          setState({
            status: 'error',
            items: [],
            stale: false,
          });
          return;
        }

        const result = await res.json();

        if (!Array.isArray(result.data)) {
          throw new Error('Invalid inventory response');
        }

        setState({
          status: 'ok',
          items: result.data,
          stale: result.stale === true,
        });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setState({
            status: 'error',
            items: [],
            stale: false,
          });
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
        <p style={{ color: 'var(--text)' }}>
          Loading inventory...
        </p>
      )}

      {state.status === 'error' && (
        <p style={{ color: 'var(--primary)' }}>
          Inventory is unavailable right now. Please try again later.
        </p>
      )}

      {state.status === 'notfound' && (
        <p style={{ color: 'var(--text)' }}>
          No inventory found for this provider.
        </p>
      )}

      {state.status === 'ok' && (
        <>
          {state.stale && (
            <p style={{ color: '#b45309', fontSize: '13px' }}>
              Showing previously saved inventory. Live data is temporarily unavailable.
            </p>
          )}

          {state.items.length === 0 && (
            <p style={{ color: 'var(--text)' }}>
              No items listed yet.
            </p>
          )}

          {state.items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {state.items.map((item) => (
                <li
                  key={item.product_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <br />
                    <small>
                      {item.category} · Quantity: {item.quantity}
                    </small>
                  </span>

                  <strong
                    style={{
                      color:
                        item.status === 'in_stock'
                          ? '#166534'
                          : item.status === 'low_stock'
                          ? '#b45309'
                          : 'var(--primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.status === 'in_stock'
                      ? 'In stock'
                      : item.status === 'low_stock'
                      ? 'Low stock'
                      : 'Out of stock'}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default ProviderInventory;
