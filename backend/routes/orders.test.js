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

function makeConn({ productRows }) {
  return {
    query: jest.fn()
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

    const orderItemInsertCall = conn.query.mock.calls[2];
    expect(orderItemInsertCall[1]).toContain(realDbPrice);
    expect(orderItemInsertCall[1]).not.toContain(0.01);
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
});
