// One place that knows what each version of Team 11's (LiteStock) API looks like.
// The rest of the app only ever sees the shape in `wanted` below:
//   [{ product_id, name, category, quantity, status }]
// Switch version with PARTNER_VERSION=v1|v2 (default v1). No other code changes.

function shapeError(version) {
  return new Error(`unexpected ${version} shape`);
}

const versions = {
  v1: {
    // Team 11 v1: { count, inventory: [{ product_id, name, category, stock_quantity, status }] }
    path: '/api/inventory',
    parse(body) {
      const ok =
        body &&
        Array.isArray(body.inventory) &&
        body.inventory.every(
          (i) => typeof i.name === 'string' && Number.isFinite(i.stock_quantity) && typeof i.status === 'string'
        );
      if (!ok) throw shapeError('v1');
      return body.inventory.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        category: i.category,
        quantity: i.stock_quantity,
        status: i.status,
      }));
    },
  },
  v2: {
    // Team 11 v2 (from their deprecation notice): { count, data: [{ productId, name, stockQuantity, ... }] }
    // ASSUMPTION: the notice gives no URL. Confirm the path with Team 11, or override with PARTNER_V2_PATH.
    path: process.env.PARTNER_V2_PATH || '/api/v2/inventory',
    parse(body) {
      const idOf = (i) => (i && i.productId !== undefined ? i.productId : i && i.id); // notice shows both
      const ok =
        body &&
        Array.isArray(body.data) &&
        body.data.every((i) => typeof i.name === 'string' && Number.isFinite(i.stockQuantity) && idOf(i) !== undefined);
      if (!ok) throw shapeError('v2');
      return body.data.map((i) => ({
        product_id: idOf(i),
        name: i.name,
        category: i.category,
        quantity: i.stockQuantity,
        status: i.status,
      }));
    },
  },
};

function current() {
  const name = process.env.PARTNER_VERSION || 'v1';
  if (!versions[name]) throw new Error(`Unknown PARTNER_VERSION "${name}"`);
  return { name, ...versions[name] };
}

module.exports = { versions, current };
