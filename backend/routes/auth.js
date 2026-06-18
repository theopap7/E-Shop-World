const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter, passwordLimiter } = require('../middleware/rateLimiters');

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

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Το email υπάρχει ήδη' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [firstName, lastName, normalizedEmail, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: 'Η εγγραφή ολοκληρώθηκε επιτυχώς',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την εγγραφή' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

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
      sameSite: isProduction ? 'strict' : 'lax',
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
        role: user.role || 'user'
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
      'SELECT id, first_name, last_name, email FROM users WHERE id = ?',
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
        email: u.email
      }
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'Όλα τα πεδία είναι υποχρεωτικά' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο email' });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email.toLowerCase().trim(), userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Το email χρησιμοποιείται ήδη από άλλο λογαριασμό' });
    }

    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
      [firstName.trim(), lastName.trim(), email.toLowerCase().trim(), userId]
    );

    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Το προφίλ ενημερώθηκε επιτυχώς',
      user: {
        id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        role: rows[0]?.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/change-password', authenticateToken, passwordLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες' });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ο χρήστης δεν βρέθηκε' });
    }

    const isOk = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isOk) {
      return res.status(401).json({ success: false, message: 'Λάθος τρέχων κωδικός' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    return res.json({ success: true, message: 'Ο κωδικός άλλαξε επιτυχώς' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });

  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true, message: 'Αποσύνδεση επιτυχής' });
});

module.exports = router;
