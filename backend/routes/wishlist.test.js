process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const request = require('supertest');
const db = require('../db');
const app = require('../server');
const { authCookie } = require('../test-utils/authCookie');

const user = () => authCookie({ id: 1, role: 'user' });

describe('GET /api/wishlist', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/wishlist');
    expect(res.status).toBe(401);
  });

  it("returns the user's wishlist items", async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, name: 'Product' }]]);
    const res = await request(app).get('/api/wishlist').set('Cookie', user());
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});

describe('POST /api/wishlist/:productId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-numeric product id', async () => {
    const res = await request(app).post('/api/wishlist/abc').set('Cookie', user());
    expect(res.status).toBe(400);
  });

  it('returns 404 when the product does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).post('/api/wishlist/999').set('Cookie', user());
    expect(res.status).toBe(404);
  });

  it('adds an existing product to the wishlist', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 5 }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app).post('/api/wishlist/5').set('Cookie', user());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /api/wishlist/:productId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-numeric product id', async () => {
    const res = await request(app).delete('/api/wishlist/abc').set('Cookie', user());
    expect(res.status).toBe(400);
  });

  it('removes a product from the wishlist', async () => {
    db.query.mockResolvedValueOnce([{}]);
    const res = await request(app).delete('/api/wishlist/5').set('Cookie', user());
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/wishlist', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears the entire wishlist', async () => {
    db.query.mockResolvedValueOnce([{}]);
    const res = await request(app).delete('/api/wishlist').set('Cookie', user());
    expect(res.status).toBe(200);
  });
});
