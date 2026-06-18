const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 10 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Πολλές αποτυχημένες προσπάθειες αλλαγής κωδικού. Δοκιμάστε ξανά σε 15 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, passwordLimiter };
