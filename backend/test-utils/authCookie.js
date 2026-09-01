const jwt = require('jsonwebtoken');

function authCookie(payload = { id: 1, role: 'user' }) {
  const token = jwt.sign(payload, process.env.JWT_SECRET);
  return `token=${token}`;
}

module.exports = { authCookie };
