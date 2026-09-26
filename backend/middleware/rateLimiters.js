const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Πολλές αποτυχημένες προσπάθειες. Δοκίμασε ξανά σε 10 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Πολλές αποτυχημένες προσπάθειες αλλαγής κωδικού. Δοκίμασε ξανά σε 15 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Πολλά αιτήματα επαναφοράς. Δοκίμασε ξανά σε 15 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkEmailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const discountLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Πολλά αιτήματα επαναποστολής. Δοκίμασε ξανά σε 15 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, passwordLimiter, forgotPasswordLimiter, checkEmailLimiter, discountLimiter, resendVerificationLimiter };
