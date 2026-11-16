const { versions } = require('./partner');

const v1Body = {
  count: 1,
  inventory: [{ product_id: 18, name: 'Laptop', category: 'Electronics', stock_quantity: 9, status: 'low_stock' }],
};
const wanted = [{ product_id: 18, name: 'Laptop', category: 'Electronics', quantity: 9, status: 'low_stock' }];

test('v1 parser gives the app the shape it expects', () => {
  expect(versions.v1.parse(v1Body)).toEqual(wanted);
});

test('v1 parser fails loudly on a different shape, not quietly', () => {
  expect(() => versions.v1.parse({ data: [] })).toThrow('unexpected v1 shape');
  expect(() => versions.v1.parse({ inventory: [{ name: 'x' }] })).toThrow('unexpected v1 shape');
});

const v2Body = {
  count: 1,
  data: [{ productId: 18, name: 'Laptop', category: 'Electronics', stockQuantity: 9, status: 'low_stock' }],
};

test('v2 parser gives the app the same shape as v1', () => {
  expect(versions.v2.parse(v2Body)).toEqual(wanted);
});

test('v2 parser accepts `id` as well as `productId` (the notice shows both)', () => {
  const body = { count: 1, data: [{ id: 18, name: 'Laptop', category: 'Electronics', stockQuantity: 9, status: 'low_stock' }] };
  expect(versions.v2.parse(body)).toEqual(wanted);
});

test('v2 parser fails loudly on a different shape, not quietly', () => {
  expect(() => versions.v2.parse(v1Body)).toThrow('unexpected v2 shape');
  expect(() => versions.v2.parse({ data: [{ name: 'x', stock_quantity: 3, productId: 1 }] })).toThrow('unexpected v2 shape');
});

test('the wrong parser fails on each version body', () => {
  expect(() => versions.v1.parse(v2Body)).toThrow('unexpected v1 shape');
});

test('PARTNER_VERSION picks the parser; default is v1; unknown value throws', () => {
  const { current } = require('./partner');
  delete process.env.PARTNER_VERSION;
  expect(current().name).toBe('v1');
  process.env.PARTNER_VERSION = 'v2';
  expect(current().name).toBe('v2');
  process.env.PARTNER_VERSION = 'v9';
  expect(() => current()).toThrow('Unknown PARTNER_VERSION');
  delete process.env.PARTNER_VERSION;
});
