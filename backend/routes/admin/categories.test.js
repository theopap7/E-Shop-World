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

describe('GET /api/admin/categories', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/categories');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/categories')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('returns categories for an admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Ηλεκτρονικά', product_count: 3 }]]);
    const res = await request(app)
      .get('/api/admin/categories')
      .set('Cookie', authCookie({ id: 1, role: 'admin' }));

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
  });
});

describe('POST /api/admin/categories', () => {
  const admin = () => authCookie({ id: 1, role: 'admin' });
  beforeEach(() => jest.clearAllMocks());

  it('rejects a payload missing name', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', admin())
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate category name', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1 }]]);
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', admin())
      .send({ name: 'Ρούχα' });
    expect(res.status).toBe(400);
  });

  it('creates a valid category', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', admin())
      .send({ name: 'Παιχνίδια' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('PUT /api/admin/categories/:id', () => {
  const admin = () => authCookie({ id: 1, role: 'admin' });
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the category does not exist', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await request(app)
      .put('/api/admin/categories/999')
      .set('Cookie', admin())
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('updates a valid category', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .put('/api/admin/categories/1')
      .set('Cookie', admin())
      .send({ name: 'Ηλεκτρονικά' });

    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  const admin = () => authCookie({ id: 1, role: 'admin' });
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the category does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app)
      .delete('/api/admin/categories/999')
      .set('Cookie', admin());
    expect(res.status).toBe(404);
  });

  it('blocks deletion of a category used by products', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Ρούχα' }]])
      .mockResolvedValueOnce([[{ count: 2 }]]);

    const res = await request(app)
      .delete('/api/admin/categories/1')
      .set('Cookie', admin());

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2/);
  });

  it('deletes an unused category', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Ρούχα' }]])
      .mockResolvedValueOnce([[{ count: 0 }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app)
      .delete('/api/admin/categories/1')
      .set('Cookie', admin());

    expect(res.status).toBe(200);
  });
});
