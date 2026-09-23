process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));
jest.mock('../utils/mailer', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined)
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../db');
const app = require('../server');

function authCookie(payload = { id: 1, role: 'user' }) {
  const token = jwt.sign(payload, process.env.JWT_SECRET);
  return `token=${token}`;
}

function makeConn({ productRows, emailVerified = true }) {
  return {
    query: jest.fn()
      .mockResolvedValueOnce([[{ email_verified: emailVerified ? 1 : 0 }]]) // SELECT email_verified
      .mockResolvedValueOnce([productRows]) // SELECT product ... FOR UPDATE
      .mockResolvedValueOnce([{ insertId: 123 }]) // INSERT INTO orders
      .mockResolvedValueOnce([{}]) // INSERT INTO order_items
      .mockResolvedValueOnce([{}]), // UPDATE products SET stock
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn()
  };
}

const basePayload = {
  items: [{ productId: 5, quantity: 1 }],
  recipientName: 'Test User',
  phone: '6900000000',
  shipping: { city: 'Athens', zip: '12345', address1: 'Main St 1' },
  shippingMethod: 'pickup',
  paymentMethod: 'cod'
};

describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue([[]]); // fallback for the post-commit email lookups
  });

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).post('/api/orders').send(basePayload);
    expect(res.status).toBe(401);
  });

  it('prices the order using the server-side product price, ignoring any client-supplied price', async () => {
    const realDbPrice = 49.99;
    const conn = makeConn({
      productRows: [{ id: 5, price: realDbPrice, stock: 10, name: 'Test Product' }]
    });
    db.getConnection.mockResolvedValue(conn);

    const tamperedPayload = {
      ...basePayload,
      items: [{ productId: 5, quantity: 1, unitPrice: 0.01, price: 0.01 }]
    };

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send(tamperedPayload);

    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(realDbPrice);
    expect(res.body.totalAmount).toBe(realDbPrice);

    const orderItemInsertCall = conn.query.mock.calls[3];
    expect(orderItemInsertCall[1]).toContain(realDbPrice);
    expect(orderItemInsertCall[1]).not.toContain(0.01);
  });

  it('rejects order creation for an unverified email', async () => {
    const conn = makeConn({
      productRows: [{ id: 5, price: 49.99, stock: 10, name: 'Test Product' }],
      emailVerified: false
    });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send(basePayload);

    expect(res.status).toBe(403);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('rejects the order when requested quantity exceeds available stock', async () => {
    const conn = makeConn({
      productRows: [{ id: 5, price: 49.99, stock: 1, name: 'Test Product' }]
    });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ ...basePayload, items: [{ productId: 5, quantity: 5 }] });

    expect(res.status).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
  });

  it('rejects a payload with an empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ ...basePayload, items: [] });

    expect(res.status).toBe(400);
  });

  it('rejects a gift message over 500 characters', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ ...basePayload, isGift: true, giftMessage: 'x'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('persists is_gift and the trimmed gift message when isGift is true', async () => {
    const conn = makeConn({
      productRows: [{ id: 5, price: 49.99, stock: 10, name: 'Test Product' }]
    });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ ...basePayload, isGift: true, giftMessage: '  Happy birthday!  ' });

    expect(res.status).toBe(201);

    const orderInsertCall = conn.query.mock.calls[2];
    expect(orderInsertCall[1]).toContain(true);
    expect(orderInsertCall[1]).toContain('Happy birthday!');
  });

  it('ignores a gift message when isGift is not set', async () => {
    const conn = makeConn({
      productRows: [{ id: 5, price: 49.99, stock: 10, name: 'Test Product' }]
    });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', authCookie())
      .send({ ...basePayload, giftMessage: 'Should be ignored' });

    expect(res.status).toBe(201);

    const orderInsertCall = conn.query.mock.calls[2];
    expect(orderInsertCall[1]).toContain(false);
    expect(orderInsertCall[1]).not.toContain('Should be ignored');
  });
});

describe('POST /api/orders/:id/return', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires a reason for every returned item', async () => {
    const res = await request(app)
      .post('/api/orders/10/return')
      .set('Cookie', authCookie())
      .send({ items: [{ productId: 5, quantity: 1, reason: 'Λάθος μέγεθος' }, { productId: 6, quantity: 1, reason: '  ' }] });

    expect(res.status).toBe(400);
    expect(db.getConnection).not.toHaveBeenCalled();
  });

  it('stores each item with its own reason and refunds after the discount', async () => {
    const conn = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ status: 'delivered', subtotal: 100, discount_amount: 10, total_amount: 95 }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[
          { product_id: 5, size: 'M', quantity: 1, unit_price: 60, product_name: 'Μπλούζα' },
          { product_id: 6, size: null, quantity: 2, unit_price: 20, product_name: 'Κάλτσες' }
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 42 }])
        .mockResolvedValue([{}]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app)
      .post('/api/orders/10/return')
      .set('Cookie', authCookie())
      .send({ items: [
        { productId: 5, quantity: 1, size: 'm', reason: ' Λάθος μέγεθος ' },
        { productId: 6, quantity: 2, reason: 'Ελαττωματικές' }
      ] });

    expect(res.status).toBe(200);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.query.mock.calls[4][1]).toEqual([10, 1, 90]);
    expect(conn.query.mock.calls[5][1]).toEqual([42, 5, 'Μπλούζα', 1, 60, 'M', 'Λάθος μέγεθος']);
    expect(conn.query.mock.calls[6][1]).toEqual([42, 6, 'Κάλτσες', 2, 20, null, 'Ελαττωματικές']);
  });
});

describe('PATCH /api/orders/:id/cancel', () => {
  beforeEach(() => jest.clearAllMocks());

  function cancelConn(order) {
    return {
      query: jest.fn().mockResolvedValueOnce([[order]]).mockResolvedValue([[]]),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };
  }

  it('lets the customer cancel an order that is still being prepared', async () => {
    const conn = cancelConn({ id: 10, user_id: 1, status: 'processing', payment_status: 'paid', discount_code: null });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app).patch('/api/orders/10/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.query.mock.calls[1][1]).toEqual(['refunded', 10]);
  });

  it('refuses to cancel an order that has already been shipped', async () => {
    const conn = cancelConn({ id: 10, user_id: 1, status: 'shipped', payment_status: 'paid', discount_code: null });
    db.getConnection.mockResolvedValue(conn);

    const res = await request(app).patch('/api/orders/10/cancel').set('Cookie', authCookie());

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Η παραγγελία δεν μπορεί πλέον να ακυρωθεί, γιατί έχει ήδη αποσταλεί');
    expect(conn.rollback).toHaveBeenCalled();
  });
});
