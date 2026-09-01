process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const request = require('supertest');
const db = require('../db');
const app = require('../server');
const { authCookie } = require('../test-utils/authCookie');

const user = (id = 1) => authCookie({ id, role: 'user' });

describe('GET /api/reviews/my', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/reviews/my');
    expect(res.status).toBe(401);
  });

  it("returns the user's own reviews", async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, rating: 5 }]]);
    const res = await request(app).get('/api/reviews/my').set('Cookie', user());
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
  });
});

describe('GET /api/reviews/:productId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-numeric product id', async () => {
    const res = await request(app).get('/api/reviews/abc');
    expect(res.status).toBe(400);
  });

  it('returns reviews with an average rating', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, rating: 4 }]])
      .mockResolvedValueOnce([[{ average: 4, total: 1 }]]);

    const res = await request(app).get('/api/reviews/5');
    expect(res.status).toBe(200);
    expect(res.body.average).toBe(4);
    expect(res.body.total).toBe(1);
  });
});

describe('POST /api/reviews/:productId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a rating outside 1-5', async () => {
    const res = await request(app).post('/api/reviews/5').set('Cookie', user()).send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  it('rejects a review from a user who has not received a delivered order for the product', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).post('/api/reviews/5').set('Cookie', user()).send({ rating: 5 });
    expect(res.status).toBe(403);
  });

  it('rejects a duplicate review from the same user', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 10 }]]) // delivered order exists
      .mockResolvedValueOnce([[{ id: 1 }]]); // existing review

    const res = await request(app).post('/api/reviews/5').set('Cookie', user()).send({ rating: 4 });
    expect(res.status).toBe(400);
  });

  it('creates a review for a verified purchase', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    const res = await request(app).post('/api/reviews/5').set('Cookie', user()).send({ rating: 4, comment: 'Nice' });
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/reviews/:reviewId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a rating outside 1-5', async () => {
    const res = await request(app).put('/api/reviews/1').set('Cookie', user()).send({ rating: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the review does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).put('/api/reviews/999').set('Cookie', user()).send({ rating: 3 });
    expect(res.status).toBe(404);
  });

  it("rejects editing another user's review", async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, user_id: 999 }]]);
    const res = await request(app).put('/api/reviews/1').set('Cookie', user(1)).send({ rating: 3 });
    expect(res.status).toBe(403);
  });

  it('updates the owner\'s review', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, user_id: 1 }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app).put('/api/reviews/1').set('Cookie', user(1)).send({ rating: 3, comment: 'Ok' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/reviews/:reviewId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when the review does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = await request(app).delete('/api/reviews/999').set('Cookie', user());
    expect(res.status).toBe(404);
  });

  it("rejects deleting another user's review as a regular user", async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, user_id: 999 }]]);
    const res = await request(app).delete('/api/reviews/1').set('Cookie', user(1));
    expect(res.status).toBe(403);
  });

  it('allows an admin to delete any review', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, user_id: 999 }]])
      .mockResolvedValueOnce([{}]);

    const res = await request(app).delete('/api/reviews/1').set('Cookie', authCookie({ id: 1, role: 'admin' }));
    expect(res.status).toBe(200);
  });
});
