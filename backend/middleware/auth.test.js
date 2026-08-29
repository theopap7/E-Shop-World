const jwt = require('jsonwebtoken');
const { authenticateToken, isAdmin } = require('./auth');

jest.mock('jsonwebtoken');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticateToken', () => {
  it('rejects requests with no token cookie', () => {
    const req = { cookies: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid/expired token', () => {
    const req = { cookies: { token: 'bad-token' } };
    const res = mockRes();
    const next = jest.fn();
    jwt.verify.mockImplementation((token, secret, cb) => cb(new Error('invalid'), null));

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the decoded payload to req.user and calls next() for a valid token', () => {
    const req = { cookies: { token: 'good-token' } };
    const res = mockRes();
    const next = jest.fn();
    const payload = { id: 1, role: 'user' };
    jwt.verify.mockImplementation((token, secret, cb) => cb(null, payload));

    authenticateToken(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('isAdmin', () => {
  it('rejects when req.user is missing', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a logged-in user whose role is not admin', () => {
    const req = { user: { id: 1, role: 'user' } };
    const res = mockRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Access denied. Admin only.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a user with the admin role', () => {
    const req = { user: { id: 1, role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
