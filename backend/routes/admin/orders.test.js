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

const admin = () => authCookie({ id: 1, role: 'admin' });

function makeStatusConn(rows) {
  return {
    query: jest.fn()
      .mockResolvedValueOnce([rows]) // SELECT status ... FOR UPDATE
      .mockResolvedValueOnce([{}]) // UPDATE orders SET status
      .mockResolvedValue([[]]), // any further queries (restock etc.)
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn()
  };
}

describe('GET /api/admin/orders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/orders');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('returns the order list for an admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'pending' }]]);
    const res = await request(app).get('/api/admin/orders').set('Cookie', admin());
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
  });
});

describe('GET /api/admin/orders/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the order does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/admin/orders/999').set('Cookie', admin());
    expect(res.status).toBe(404);
  });

  it('returns order details with items and return request', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, user_id: 5 }]])
      .mockResolvedValueOnce([[{ product_id: 2, quantity: 1 }]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/admin/orders/1').set('Cookie', admin());
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.returnRequest).toBeNull();
  });
});

describe('PATCH /api/admin/orders/:id/status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an unrecognized status value', async () => {
    const res = await request(app)
      .patch('/api/admin/orders/1/status')
      .set('Cookie', admin())
      .send({ status: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('rejects a disallowed status transition', async () => {
    const conn = makeStatusConn([{ status: 'delivered', payment_method: 'cod', payment_status: 'paid' }]);
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .patch('/api/admin/orders/1/status')
      .set('Cookie', admin())
      .send({ status: 'processing' });

    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('marks a COD order as paid when delivered', async () => {
    const conn = makeStatusConn([{ status: 'shipped', payment_method: 'cod', payment_status: 'unpaid' }]);
    db.getConnection.mockResolvedValue(conn);
    db.query.mockResolvedValue([[]]);

    const res = await request(app)
      .patch('/api/admin/orders/1/status')
      .set('Cookie', admin())
      .send({ status: 'delivered' });

    expect(res.status).toBe(200);
    expect(conn.commit).toHaveBeenCalled();
    const updateCall = conn.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/payment_status = 'paid'/);
  });

  it('restocks items and refunds a paid order on cancellation', async () => {
    const conn = makeStatusConn([{ status: 'pending', payment_method: 'card_mock', payment_status: 'paid' }]);
    db.getConnection.mockResolvedValue(conn);
    db.query.mockResolvedValue([[]]);

    const res = await request(app)
      .patch('/api/admin/orders/1/status')
      .set('Cookie', admin())
      .send({ status: 'cancelled' });

    expect(res.status).toBe(200);
    const updateCall = conn.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/payment_status = 'refunded'/);
  });
});

describe('PATCH /api/admin/orders/:id/confirm-payment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the order does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).patch('/api/admin/orders/999/confirm-payment').set('Cookie', admin());
    expect(res.status).toBe(404);
  });

  it('rejects confirming a payment that is not pending', async () => {
    db.query.mockResolvedValueOnce([[{ payment_status: 'paid' }]]);
    const res = await request(app).patch('/api/admin/orders/1/confirm-payment').set('Cookie', admin());
    expect(res.status).toBe(400);
  });

  it('confirms a pending payment', async () => {
    db.query
      .mockResolvedValueOnce([[{ payment_status: 'pending' }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app).patch('/api/admin/orders/1/confirm-payment').set('Cookie', admin());
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/orders/:id/csv', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the order does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/admin/orders/999/csv').set('Cookie', admin());
    expect(res.status).toBe(404);
  });

  it('returns a CSV file for a valid order', async () => {
    db.query
      .mockResolvedValueOnce([[{
        id: 1, created_at: new Date(), status: 'pending', payment_method: 'cod', payment_status: 'unpaid',
        total_amount: 10, subtotal: 10, shipping_cost: 0, shipping_method: 'pickup',
        ship_address1: 'Main St', ship_city: 'Athens', ship_zip: '12345', ship_country: 'GR',
        floor: '1', ship_notes: '', recipient_name: 'Test', phone: '69000', first_name: 'A', last_name: 'B', email: 'a@b.com'
      }]])
      .mockResolvedValueOnce([[{ name: 'Product', quantity: 1, unit_price: 10 }]]);

    const res = await request(app).get('/api/admin/orders/1/csv').set('Cookie', admin());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });
});
