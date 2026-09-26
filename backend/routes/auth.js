const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter, passwordLimiter, forgotPasswordLimiter, checkEmailLimiter, resendVerificationLimiter } = require('../middleware/rateLimiters');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/mailer');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες, ένα κεφαλαίο, ένα πεζό και έναν αριθμό';

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ success: false, message: 'Το όνομα και το επώνυμο είναι υποχρεωτικά' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο email' });
    }

    if (!password || !PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Το email υπάρχει ήδη' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (first_name, last_name, email, password, email_verified) VALUES (?, ?, ?, ?, FALSE)',
      [firstName.trim(), lastName.trim(), normalizedEmail, hashedPassword]
    );

    const userId = result.insertId;

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, verifyToken, verifyExpiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const verifyLink = `${frontendUrl}/verify-email?token=${verifyToken}`;

    res.status(201).json({
      success: true,
      message: 'Η εγγραφή ολοκληρώθηκε επιτυχώς',
      userId
    });

    // Backgrounded: mailer has its own connect/send timeouts, so this always
    // settles (and logs) within a few seconds instead of hanging forever.
    sendVerificationEmail(normalizedEmail, verifyLink).catch((emailErr) => {
      console.error('Verification email failed (non-critical):', emailErr.message);
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την εγγραφή' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Λείπει ο σύνδεσμος επιβεβαίωσης' });
    }

    const [rows] = await db.query(
      'SELECT * FROM email_verification_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );

    if (rows.length === 0) {
      const [usedRows] = await db.query(
        `SELECT u.email_verified FROM email_verification_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token = ?`,
        [token]
      );
      if (usedRows.length > 0 && usedRows[0].email_verified) {
        return res.json({ success: true, alreadyVerified: true, message: 'Το email σου είναι ήδη επιβεβαιωμένο' });
      }
      return res.status(400).json({ success: false, message: 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει' });
    }

    const verifyRecord = rows[0];

    await db.query('UPDATE users SET email_verified = TRUE WHERE id = ?', [verifyRecord.user_id]);
    await db.query('UPDATE email_verification_tokens SET used = TRUE WHERE id = ?', [verifyRecord.id]);

    res.json({ success: true, message: 'Το email επιβεβαιώθηκε επιτυχώς!' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την επιβεβαίωση email' });
  }
});

router.post('/resend-verification', resendVerificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Το email είναι υποχρεωτικό' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [users] = await db.query('SELECT id, email_verified FROM users WHERE email = ?', [normalizedEmail]);

    // Always respond success to prevent email enumeration
    if (users.length === 0 || users[0].email_verified) {
      return res.json({ success: true, message: 'Αν ο λογαριασμός υπάρχει και δεν έχει επιβεβαιωθεί, θα λάβεις νέο σύνδεσμο.' });
    }

    const userId = users[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query('UPDATE email_verification_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [userId]);

    await db.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

    res.json({
      success: true,
      message: 'Αν ο λογαριασμός υπάρχει και δεν έχει επιβεβαιωθεί, θα λάβεις νέο σύνδεσμο.'
    });

    sendVerificationEmail(normalizedEmail, verifyLink).catch((emailErr) => {
      console.error('Resend verification email failed (non-critical):', emailErr.message);
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την επαναποστολή' });
  }
});

router.get('/check-email', checkEmailLimiter, async (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.json({ success: true, exists: false });
    }

    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    res.json({ success: true, exists: rows.length > 0 });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Λείπει email ή κωδικός' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Λάθος email ή κωδικός' });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Λάθος email ή κωδικός' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Επιτυχής σύνδεση',
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        address: {
          country: user.address_country,
          city: user.address_city,
          zip: user.address_zip,
          address1: user.address1,
          floor: user.address_floor
        },
        role: user.role || 'user',
        emailVerified: !!user.email_verified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά τη σύνδεση' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      'SELECT id, first_name, last_name, email, phone, address_country, address_city, address_zip, address1, address_floor, role, email_verified FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ο χρήστης δεν βρέθηκε' });
    }

    const u = rows[0];
    return res.json({
      success: true,
      user: {
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        phone: u.phone,
        address: {
          country: u.address_country,
          city: u.address_city,
          zip: u.address_zip,
          address1: u.address1,
          floor: u.address_floor
        },
        role: u.role || 'user',
        emailVerified: !!u.email_verified
      }
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email, phone, address } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'Όλα τα πεδία είναι υποχρεωτικά' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο email' });
    }

    const trimmedPhone = phone ? String(phone).trim() : null;
    const phoneRegex = /^(\+30|0030)?[269]\d{9}$/;
    if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο τηλέφωνο (π.χ. 6912345678 ή +306912345678)' });
    }

    const addr = address || {};
    const trimmedAddress = {
      country: addr.country ? String(addr.country).trim() : 'ΕΛΛΑΔΑ',
      city: addr.city ? String(addr.city).trim() : null,
      zip: addr.zip ? String(addr.zip).trim() : null,
      address1: addr.address1 ? String(addr.address1).trim() : null,
      floor: addr.floor ? String(addr.floor).trim() : null
    };

    const normalizedEmail = email.toLowerCase().trim();

    const [currentRows] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
    const emailChanged = currentRows[0]?.email !== normalizedEmail;

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [normalizedEmail, userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Το email χρησιμοποιείται ήδη από άλλο λογαριασμό' });
    }

    await db.query(
      `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?,
       address_country = ?, address_city = ?, address_zip = ?, address1 = ?, address_floor = ?${emailChanged ? ', email_verified = FALSE' : ''}
       WHERE id = ?`,
      [
        firstName.trim(), lastName.trim(), normalizedEmail, trimmedPhone,
        trimmedAddress.country, trimmedAddress.city, trimmedAddress.zip, trimmedAddress.address1, trimmedAddress.floor,
        userId
      ]
    );

    if (emailChanged) {
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query('UPDATE email_verification_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [userId]);
      await db.query(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [userId, verifyToken, verifyExpiresAt]
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const verifyLink = `${frontendUrl}/verify-email?token=${verifyToken}`;

      sendVerificationEmail(normalizedEmail, verifyLink).catch((emailErr) => {
        console.error('Verification email failed (non-critical):', emailErr.message);
      });
    }

    const [rows] = await db.query('SELECT role, email_verified FROM users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Το προφίλ ενημερώθηκε επιτυχώς',
      user: {
        id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: trimmedPhone,
        address: trimmedAddress,
        role: rows[0]?.role,
        emailVerified: !!rows[0]?.email_verified
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.post('/change-password', authenticateToken, passwordLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || !PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ο χρήστης δεν βρέθηκε' });
    }

    const isOk = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isOk) {
      return res.status(401).json({ success: false, message: 'Λάθος τρέχων κωδικός' });
    }

    const isSame = await bcrypt.compare(newPassword, rows[0].password);
    if (isSame) {
      return res.status(400).json({ success: false, message: 'Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    return res.json({ success: true, message: 'Ο κωδικός άλλαξε επιτυχώς' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });

  }
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Το email είναι υποχρεωτικό' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [users] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);

    // Always respond success to prevent email enumeration
    if (users.length === 0) {
      return res.json({ success: true, message: 'Αν το email υπάρχει, θα λάβεις σύνδεσμο επαναφοράς.' });
    }

    const userId = users[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND used = FALSE', [userId]);

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    res.json({
      success: true,
      message: 'Αν το email υπάρχει, θα λάβεις σύνδεσμο επαναφοράς.'
    });

    // Fire-and-forget: response already sent, doesn't block on the SMTP round-trip.
    (async () => {
      try {
        await sendPasswordResetEmail(normalizedEmail, resetLink);
      } catch (emailErr) {
        console.error('Password reset email failed (non-critical):', emailErr.message);
      }
    })();
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την επαναφορά κωδικού' });
  }
});

router.post('/reset-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || !PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_MESSAGE });
    }

    const [rows] = await db.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, code: 'invalid_token', message: 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει' });
    }

    const resetRecord = rows[0];
    const hashed = await bcrypt.hash(newPassword, 10);

    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, resetRecord.user_id]);
    await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [resetRecord.id]);

    res.json({ success: true, message: 'Ο κωδικός άλλαξε επιτυχώς. Μπορείς τώρα να συνδεθείς.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την αλλαγή κωδικού' });
  }
});

router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
  res.json({ success: true, message: 'Αποσύνδεση επιτυχής' });
});

module.exports = router;
