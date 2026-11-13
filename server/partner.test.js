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

// After you read Team 11's notice: write v2.parse in partner.js, then replace this line with real tests
// (same pattern: a sample v2 body in, the same `wanted` shape out, and the wrong parser throws).
test.todo('v2 parser matches the example in the partner notice');
