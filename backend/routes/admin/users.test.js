process.env.JWT_SECRET = 'test-secret';

jest.mock('../../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const request = require('supertest');
const db = require('../../db');
const app = require('../../server');
const { authCookie } = require('../../test-utils/authCookie');

describe('GET /api/admin/users', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('returns the user list with order stats for an admin', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email: 'a@b.com', order_count: 2, total_spent: 100 }]]);
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', authCookie({ id: 1, role: 'admin' }));

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });
});
