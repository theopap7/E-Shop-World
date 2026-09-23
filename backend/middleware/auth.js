const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Πρέπει να συνδεθείς' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Η συνεδρία δεν είναι έγκυρη. Συνδέσου ξανά.' });
    }
    req.user = payload;
    next();
  });
}

function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Δεν έχεις δικαίωμα πρόσβασης.' });
  }
  next();
}

module.exports = { authenticateToken, isAdmin };
