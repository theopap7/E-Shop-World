process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const request = require('supertest');
const db = require('../db');
const app = require('../server');
const { authCookie } = require('../test-utils/authCookie');

const user = () => authCookie({ id: 1, role: 'user' });

function discountRow(overrides = {}) {
  return {
    id: 1,
    code: 'SALE10',
    type: 'percentage',
    value: 10,
    min_order_amount: 0,
    max_uses: null,
    used_count: 0,
    active: 1,
    expires_at: null,
    ...overrides
  };
}

describe('POST /api/validate-discount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).post('/api/validate-discount').send({ code: 'X', orderTotal: 10 });
    expect(res.status).toBe(401);
  });

  it('rejects a missing code', async () => {
    const res = await request(app).post('/api/validate-discount').set('Cookie', user()).send({ orderTotal: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown or inactive code', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'NOPE', orderTotal: 10 });
    expect(res.status).toBe(404);
  });

  it('rejects a code the user has already used', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow()]])
      .mockResolvedValueOnce([[{ id: 1 }]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow({ expires_at: '2000-01-01' })]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects a code that has hit its max uses', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow({ max_uses: 5, used_count: 5 })]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative order total', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow()]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects an order total below the minimum', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow({ min_order_amount: 50 })]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: 20 });
    expect(res.status).toBe(400);
  });

  it('applies a percentage discount', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow({ type: 'percentage', value: 10 })]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: 100 });

    expect(res.status).toBe(200);
    expect(res.body.discount.amount).toBe(10);
  });

  it('caps a fixed discount at the order total', async () => {
    db.query
      .mockResolvedValueOnce([[discountRow({ type: 'fixed', value: 50 })]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/validate-discount')
      .set('Cookie', user())
      .send({ code: 'SALE10', orderTotal: 20 });

    expect(res.status).toBe(200);
    expect(res.body.discount.amount).toBe(20);
  });
});
