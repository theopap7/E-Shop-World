process.env.JWT_SECRET = 'test-secret';

jest.mock('../../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));
jest.mock('../../utils/mailer', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: jest.fn().mockResolvedValue(undefined)
}));

const request = require('supertest');
const db = require('../../db');
const app = require('../../server');
const { authCookie } = require('../../test-utils/authCookie');

describe('GET /api/admin/discount-codes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/discount-codes');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('returns discount codes for an admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, code: 'SALE10' }]]);
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Cookie', authCookie({ id: 1, role: 'admin' }));

    expect(res.status).toBe(200);
    expect(res.body.codes).toHaveLength(1);
  });
});

describe('POST /api/admin/discount-codes', () => {
  const admin = () => authCookie({ id: 1, role: 'admin' });
  beforeEach(() => jest.clearAllMocks());

  it('rejects a payload missing required fields', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Cookie', admin())
      .send({ code: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid type', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Cookie', admin())
      .send({ code: 'X', type: 'bogus', value: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive value', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Cookie', admin())
      .send({ code: 'X', type: 'fixed', value: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects a percentage value over 100', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Cookie', admin())
      .send({ code: 'X', type: 'percentage', value: 150 });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate code', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1 }]]); // existing code lookup
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Cookie', admin())
      .send({ code: 'SALE10', type: 'fixed', value: 5 });
    expect(res.status).toBe(400);
  });

  it('creates a valid discount code', async () => {
    db.query
      .mockResolvedValueOnce([[]]) // no existing code
      .mockResolvedValueOnce([{ insertId: 1 }]); // insert

    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Cookie', admin())
      .send({ code: 'sale10', type: 'percentage', value: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('PUT /api/admin/discount-codes/:id', () => {
  const admin = () => authCookie({ id: 1, role: 'admin' });
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the code does not exist', async () => {
    db.query
      .mockResolvedValueOnce([[]]) // no duplicate
      .mockResolvedValueOnce([{ affectedRows: 0 }]); // update

    const res = await request(app)
      .put('/api/admin/discount-codes/999')
      .set('Cookie', admin())
      .send({ code: 'X', type: 'fixed', value: 5 });

    expect(res.status).toBe(404);
  });

  it('updates a valid discount code', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .put('/api/admin/discount-codes/1')
      .set('Cookie', admin())
      .send({ code: 'X', type: 'fixed', value: 5, active: true });

    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/admin/discount-codes/:id', () => {
  const admin = () => authCookie({ id: 1, role: 'admin' });
  beforeEach(() => jest.clearAllMocks());

  it('blocks deletion of a code that has been used', async () => {
    db.query.mockResolvedValueOnce([[{ count: 3 }]]);
    const res = await request(app)
      .delete('/api/admin/discount-codes/1')
      .set('Cookie', admin());

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/3/);
  });

  it('deletes an unused discount code', async () => {
    db.query
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .delete('/api/admin/discount-codes/1')
      .set('Cookie', admin());

    expect(res.status).toBe(200);
  });
});
