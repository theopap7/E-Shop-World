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

describe('GET /api/admin/products', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/products');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('returns the product list for an admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Test' }]]);
    const res = await request(app).get('/api/admin/products').set('Cookie', admin());
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
  });
});

describe('GET /api/admin/products/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the product does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).get('/api/admin/products/999').set('Cookie', admin());
    expect(res.status).toBe(404);
  });

  it('returns the product', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Test' }]]);
    const res = await request(app).get('/api/admin/products/1').set('Cookie', admin());
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(1);
  });
});

describe('POST /api/admin/products', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a payload missing required fields', async () => {
    const res = await request(app).post('/api/admin/products').set('Cookie', admin()).send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive price', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Cookie', admin())
      .send({ name: 'X', price: 0, stock: 5 });
    expect(res.status).toBe(400);
  });

  it('rejects a negative stock value', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Cookie', admin())
      .send({ name: 'X', price: 10, stock: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app)
      .post('/api/admin/products')
      .set('Cookie', admin())
      .send({ name: 'X', price: 10, stock: 5, category_id: 999 });
    expect(res.status).toBe(400);
  });

  it('creates a valid product', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1 }]]) // category lookup
      .mockResolvedValueOnce([{ insertId: 42 }]); // insert

    const res = await request(app)
      .post('/api/admin/products')
      .set('Cookie', admin())
      .send({ name: 'X', price: 10, stock: 5, category_id: 1 });

    expect(res.status).toBe(201);
    expect(res.body.productId).toBe(42);
  });
});

describe('PUT /api/admin/products/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the product does not exist', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const res = await request(app)
      .put('/api/admin/products/999')
      .set('Cookie', admin())
      .send({ name: 'X', price: 10, stock: 5 });
    expect(res.status).toBe(404);
  });

  it('updates a valid product', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app)
      .put('/api/admin/products/1')
      .set('Cookie', admin())
      .send({ name: 'X', price: 10, stock: 5 });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/admin/products/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the product does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).delete('/api/admin/products/999').set('Cookie', admin());
    expect(res.status).toBe(404);
  });

  it('blocks deletion of a product referenced by existing orders', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Test' }]])
      .mockResolvedValueOnce([[{ count: 2 }]]);

    const res = await request(app).delete('/api/admin/products/1').set('Cookie', admin());
    expect(res.status).toBe(400);
  });

  it('deletes a product with no order history', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Test' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app).delete('/api/admin/products/1').set('Cookie', admin());
    expect(res.status).toBe(200);
  });
});
