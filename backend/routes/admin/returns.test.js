process.env.JWT_SECRET = 'test-secret';

jest.mock('../../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const request = require('supertest');
const db = require('../../db');
const app = require('../../server');
const { authCookie } = require('../../test-utils/authCookie');

const admin = () => authCookie({ id: 1, role: 'admin' });

function makeConn(returnRow, extraResponses = []) {
  const query = jest.fn().mockResolvedValueOnce([[returnRow]]); // SELECT ... FOR UPDATE
  for (const resp of extraResponses) query.mockResolvedValueOnce(resp);
  query.mockResolvedValue([[]]);
  return {
    query,
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn()
  };
}

describe('GET /api/admin/returns', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/returns');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/returns')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('groups return items under their parent request', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, order_id: 10 }]])
      .mockResolvedValueOnce([[{ return_request_id: 1, product_id: 5, quantity: 1 }]]);

    const res = await request(app).get('/api/admin/returns').set('Cookie', admin());
    expect(res.status).toBe(200);
    expect(res.body.returns[0].items).toHaveLength(1);
  });
});

describe('PATCH /api/admin/returns/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  const pendingRequest = { id: 1, order_id: 10, current_status: 'pending', subtotal: 100, discount_amount: 0, total_amount: 105 };
  const twoItems = [
    { id: 7, product_id: 5, quantity: 1, unit_price: 60, size: 'M' },
    { id: 8, product_id: 6, quantity: 2, unit_price: 20, size: null }
  ];

  it('rejects an invalid decision', async () => {
    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'bogus' }] });
    expect(res.status).toBe(400);
  });

  it('rejects a request with no item decisions', async () => {
    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ status: 'approved' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the request does not exist', async () => {
    const conn = { query: jest.fn().mockResolvedValueOnce([[]]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/999')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'approved' }] });

    expect(res.status).toBe(404);
  });

  it('rejects processing an already-processed request', async () => {
    const conn = makeConn({ ...pendingRequest, current_status: 'approved' });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'approved' }] });

    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('requires a decision for every item in the request', async () => {
    const conn = makeConn(pendingRequest, [[twoItems]]);
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'approved' }] });

    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('approves every item, marks the order fully refunded and restocks everything', async () => {
    const conn = makeConn(pendingRequest, [
      [twoItems],
      [{}], [{}],
      [{}],
      [[{ totalRefunded: 100 }]],
      [{}]
    ]);
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'approved' }, { id: 8, status: 'approved' }] });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.query.mock.calls[4][1]).toEqual(['approved', null, 100, 1]);
    expect(conn.query.mock.calls[6][1]).toEqual(['refunded', 10]);
    const stockUpdates = conn.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE products SET stock'));
    expect(stockUpdates.map(([, params]) => params)).toEqual([[1, 5], [2, 6]]);
  });

  it('partially approves a request and refunds and restocks only the approved item', async () => {
    const conn = makeConn({ ...pendingRequest, discount_amount: 10 }, [
      [twoItems],
      [{}], [{}],
      [{}],
      [[{ totalRefunded: 54 }]],
      [{}]
    ]);
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'approved' }, { id: 8, status: 'rejected' }], adminNote: 'Το δεύτερο είναι φορεμένο' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('partially_approved');
    expect(conn.query.mock.calls[2][1]).toEqual(['approved', 7]);
    expect(conn.query.mock.calls[3][1]).toEqual(['rejected', 8]);
    expect(conn.query.mock.calls[4][1]).toEqual(['partially_approved', 'Το δεύτερο είναι φορεμένο', 54, 1]);
    expect(conn.query.mock.calls[6][1]).toEqual(['partially_refunded', 10]);
    const stockUpdates = conn.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE products SET stock'));
    expect(stockUpdates.map(([, params]) => params)).toEqual([[1, 5]]);
  });

  it('rejects every item without touching payment or stock', async () => {
    const conn = makeConn(pendingRequest, [[twoItems]]);
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ items: [{ id: 7, status: 'rejected' }, { id: 8, status: 'rejected' }], adminNote: '  ' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(conn.query.mock.calls[4][1]).toEqual(['rejected', null, 0, 1]);
    expect(conn.query).toHaveBeenCalledTimes(5);
  });
});
