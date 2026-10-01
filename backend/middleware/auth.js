const jwt = require('jsonwebtoken');
const { DEMO_ROLE } = require('../utils/demoMask');

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const ADMIN_PANEL_ROLES = ['admin', DEMO_ROLE];

function authenticateToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Πρέπει να συνδεθείς' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Η συνεδρία δεν είναι έγκυρη. Συνδέσου ξανά.' });
    }
    if (payload.role === DEMO_ROLE && !READ_ONLY_METHODS.includes(req.method)) {
      return res.status(403).json({
        success: false,
        code: 'demo_read_only',
        message: 'Ο demo λογαριασμός είναι μόνο για προβολή'
      });
    }
    req.user = payload;
    next();
  });
}

function isAdmin(req, res, next) {
  if (!req.user || !ADMIN_PANEL_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Δεν έχεις δικαίωμα πρόσβασης.' });
  }
  next();
}

module.exports = { authenticateToken, isAdmin };
