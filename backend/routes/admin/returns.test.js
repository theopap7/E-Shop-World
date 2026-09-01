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

  it('rejects an invalid status value', async () => {
    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the request does not exist', async () => {
    const conn = { query: jest.fn().mockResolvedValueOnce([[]]), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/999')
      .set('Cookie', admin())
      .send({ status: 'approved' });

    expect(res.status).toBe(404);
  });

  it('rejects processing an already-processed request', async () => {
    const conn = makeConn({ id: 1, order_id: 10, current_status: 'approved', subtotal: 50, discount_amount: 0 });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ status: 'approved' });

    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('approves a return, marks order fully refunded, and restocks items', async () => {
    const conn = makeConn(
      { id: 1, order_id: 10, current_status: 'pending', subtotal: 50, discount_amount: 0 },
      [
        [{}], // UPDATE return_requests SET status
        [[{ totalRefunded: 50 }]], // SUM refund_amount
        [{}], // UPDATE orders SET payment_status
        [[{ product_id: 5, quantity: 2 }]] // return_request_items
      ]
    );
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(conn.commit).toHaveBeenCalled();
    const orderUpdateCall = conn.query.mock.calls[3];
    expect(orderUpdateCall[1]).toEqual(['refunded', 10]);
  });

  it('rejects a return with an admin note trimmed to empty', async () => {
    const conn = makeConn(
      { id: 1, order_id: 10, current_status: 'pending', subtotal: 50, discount_amount: 0 },
      [[{}]]
    );
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/returns/1')
      .set('Cookie', admin())
      .send({ status: 'rejected', adminNote: '  ' });

    expect(res.status).toBe(200);
    const updateCall = conn.query.mock.calls[1];
    expect(updateCall[1]).toEqual(['rejected', null, 1]);
  });
});
