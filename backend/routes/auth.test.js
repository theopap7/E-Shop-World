process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));
jest.mock('../utils/mailer', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../db');
const app = require('../server');

function authCookie(payload = { id: 1, role: 'user' }) {
  const token = jwt.sign(payload, process.env.JWT_SECRET);
  return `token=${token}`;
}

describe('GET /api/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests with no auth cookie', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('returns the phone and address alongside the rest of the profile', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 1,
      first_name: 'Test',
      last_name: 'User',
      email: 'test@test.com',
      phone: '6900000000',
      address_country: 'ΕΛΛΑΔΑ',
      address_city: 'Athens',
      address_zip: '12345',
      address1: 'Main St 1',
      address_floor: '2'
    }]]);

    const res = await request(app).get('/api/me').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('6900000000');
    expect(res.body.user.address).toEqual({
      country: 'ΕΛΛΑΔΑ',
      city: 'Athens',
      zip: '12345',
      address1: 'Main St 1',
      floor: '2'
    });
  });
});

describe('PUT /api/me', () => {
  const basePayload = { firstName: 'Test', lastName: 'User', email: 'test@test.com' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid phone format', async () => {
    const res = await request(app)
      .put('/api/me')
      .set('Cookie', authCookie())
      .send({ ...basePayload, phone: '12345' });

    expect(res.status).toBe(400);
  });

  it('accepts a valid phone and optional address, persisting both', async () => {
    db.query
      .mockResolvedValueOnce([[]]) // email-taken check
      .mockResolvedValueOnce([{}]) // UPDATE users
      .mockResolvedValueOnce([[{ role: 'user' }]]); // SELECT role

    const res = await request(app)
      .put('/api/me')
      .set('Cookie', authCookie())
      .send({
        ...basePayload,
        phone: '6912345678',
        address: { city: 'Athens', zip: '12345', address1: 'Main St 1', floor: '2' }
      });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('6912345678');
    expect(res.body.user.address).toEqual({
      country: 'ΕΛΛΑΔΑ',
      city: 'Athens',
      zip: '12345',
      address1: 'Main St 1',
      floor: '2'
    });

    const updateCall = db.query.mock.calls[1];
    expect(updateCall[1]).toContain('6912345678');
    expect(updateCall[1]).toContain('Athens');
  });

  it('allows clearing the phone by sending an empty value', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ role: 'user' }]]);

    const res = await request(app)
      .put('/api/me')
      .set('Cookie', authCookie())
      .send({ ...basePayload, phone: '' });

    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBeNull();
  });
});
