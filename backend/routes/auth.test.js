process.env.JWT_SECRET = 'test-secret';

jest.mock('../db', () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));
jest.mock('../utils/mailer', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue({ previewUrl: null })
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../db');
const app = require('../server');
const mailer = require('../utils/mailer');

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
      .mockResolvedValueOnce([[{ email: 'test@test.com' }]]) // current email lookup
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

    const updateCall = db.query.mock.calls[2];
    expect(updateCall[1]).toContain('6912345678');
    expect(updateCall[1]).toContain('Athens');
  });

  it('allows clearing the phone by sending an empty value', async () => {
    db.query
      .mockResolvedValueOnce([[{ email: 'test@test.com' }]])
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

  it('resets email_verified and sends a new verification email when the email changes', async () => {
    db.query
      .mockResolvedValueOnce([[{ email: 'old@test.com' }]]) // current email lookup
      .mockResolvedValueOnce([[]]) // email-taken check
      .mockResolvedValueOnce([{}]) // UPDATE users
      .mockResolvedValueOnce([{}]) // invalidate old tokens
      .mockResolvedValueOnce([{}]) // insert new token
      .mockResolvedValueOnce([[{ role: 'user', email_verified: 0 }]]); // SELECT role

    const res = await request(app)
      .put('/api/me')
      .set('Cookie', authCookie())
      .send({ ...basePayload, email: 'new@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(false);

    const updateCall = db.query.mock.calls[2];
    expect(updateCall[0]).toContain('email_verified = FALSE');

    const insertTokenCall = db.query.mock.calls[4];
    expect(insertTokenCall[0]).toContain('INSERT INTO email_verification_tokens');
  });
});

describe('POST /api/register', () => {
  const basePayload = { firstName: 'Test', lastName: 'User', email: 'new@test.com', password: 'password123' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the user as unverified and sends a verification email', async () => {
    db.query
      .mockResolvedValueOnce([[]]) // existing user check
      .mockResolvedValueOnce([{ insertId: 42 }]) // INSERT INTO users
      .mockResolvedValueOnce([{}]); // INSERT INTO email_verification_tokens

    const res = await request(app).post('/api/register').send(basePayload);

    expect(res.status).toBe(201);

    const insertUserCall = db.query.mock.calls[1];
    expect(insertUserCall[0]).toContain('email_verified');
    expect(insertUserCall[0]).toContain('FALSE');

    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mailer.sendVerificationEmail.mock.calls[0][0]).toBe('new@test.com');
    expect(mailer.sendVerificationEmail.mock.calls[0][1]).toContain('/verify-email?token=');
  });
});

describe('POST /api/verify-email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a missing token', async () => {
    const res = await request(app).post('/api/verify-email').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid or expired token', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const res = await request(app).post('/api/verify-email').send({ token: 'bad-token' });

    expect(res.status).toBe(400);
  });

  it('marks the user verified and the token used for a valid token', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 5, user_id: 7 }]]) // token lookup
      .mockResolvedValueOnce([{}]) // UPDATE users
      .mockResolvedValueOnce([{}]); // UPDATE email_verification_tokens

    const res = await request(app).post('/api/verify-email').send({ token: 'good-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updateUserCall = db.query.mock.calls[1];
    expect(updateUserCall[0]).toContain('email_verified = TRUE');
    expect(updateUserCall[1]).toEqual([7]);
  });
});

describe('POST /api/resend-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('responds with success without leaking whether the account exists', async () => {
    db.query.mockResolvedValueOnce([[]]); // no user found

    const res = await request(app).post('/api/resend-verification').send({ email: 'nobody@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does nothing if the account is already verified', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, email_verified: 1 }]]);

    const res = await request(app).post('/api/resend-verification').send({ email: 'verified@test.com' });

    expect(res.status).toBe(200);
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends a new token for an unverified account', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 9, email_verified: 0 }]]) // user lookup
      .mockResolvedValueOnce([{}]) // invalidate old tokens
      .mockResolvedValueOnce([{}]); // insert new token

    const res = await request(app).post('/api/resend-verification').send({ email: 'unverified@test.com' });

    expect(res.status).toBe(200);
    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
