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

describe('GET /api/admin/stats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', authCookie({ id: 1, role: 'user' }));
    expect(res.status).toBe(403);
  });

  it('aggregates dashboard stats and charts for an admin', async () => {
    db.query
      .mockResolvedValueOnce([[{ total: 10 }]]) // orders count
      .mockResolvedValueOnce([[{ total: 500 }]]) // revenue
      .mockResolvedValueOnce([[{ total: 4 }]]) // users count
      .mockResolvedValueOnce([[{ total: 8 }]]) // products count
      .mockResolvedValueOnce([[{ total: 2 }]]) // pending orders
      .mockResolvedValueOnce([[{ total: 1 }]]) // pending payments
      .mockResolvedValueOnce([[{ total: 0 }]]) // pending returns
      .mockResolvedValueOnce([[{ day: '2026-01-01', orders: 3, revenue: 90 }]]) // daily orders
      .mockResolvedValueOnce([[{ status: 'pending', count: 2 }]]) // status breakdown
      .mockResolvedValueOnce([[{ name: 'Product', total_sold: 5 }]]); // top products

    const res = await request(app).get('/api/admin/stats').set('Cookie', admin());

    expect(res.status).toBe(200);
    expect(res.body.stats.totalOrders).toBe(10);
    expect(res.body.stats.totalRevenue).toBe(500);
    expect(res.body.charts.topProducts).toHaveLength(1);
  });
});

describe('GET /api/admin/stats/charts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns charts for the default 30-day range', async () => {
    db.query
      .mockResolvedValueOnce([[{ day: '2026-01-01', orders: 1, revenue: 10 }]])
      .mockResolvedValueOnce([[{ status: 'pending', count: 1 }]])
      .mockResolvedValueOnce([[{ name: 'Product', total_sold: 1 }]]);

    const res = await request(app).get('/api/admin/stats/charts').set('Cookie', admin());

    expect(res.status).toBe(200);
    expect(res.body.dailyOrders).toHaveLength(1);
  });

  it('returns charts for an all-time range without a date filter', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const res = await request(app).get('/api/admin/stats/charts?range=all').set('Cookie', admin());

    expect(res.status).toBe(200);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).not.toMatch(/created_at >=/);
    expect(params).toEqual([]);
  });
});
