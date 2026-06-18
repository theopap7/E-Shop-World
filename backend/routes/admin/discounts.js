const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/discount-codes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, code, type, value, min_order_amount, max_uses, used_count, active, expires_at, created_at
       FROM discount_codes ORDER BY created_at DESC`
    );
    res.json({ success: true, codes: rows });
  } catch (error) {
    console.error('Get discount codes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/admin/discount-codes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { code, type, value, minOrderAmount, maxUses, expiresAt } = req.body;

    if (!code || !type || value == null) {
      return res.status(400).json({ success: false, message: 'Κωδικός, τύπος και αξία είναι υποχρεωτικά' });
    }

    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Τύπος πρέπει να είναι percentage ή fixed' });
    }

    if (type === 'percentage' && (Number(value) < 0 || Number(value) > 100)) {
      return res.status(400).json({ success: false, message: 'Ποσοστό πρέπει να είναι 0-100' });
    }

    const [existing] = await db.query(
      'SELECT id FROM discount_codes WHERE code = ?',
      [String(code).toUpperCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Ο κωδικός υπάρχει ήδη' });
    }

    await db.query(
      `INSERT INTO discount_codes (code, type, value, min_order_amount, max_uses, expires_at, active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [
        String(code).toUpperCase(),
        type,
        Number(value),
        Number(minOrderAmount || 0),
        maxUses ? Number(maxUses) : null,
        expiresAt || null
      ]
    );

    res.json({ success: true, message: 'Κωδικός δημιουργήθηκε' });
  } catch (error) {
    console.error('Create discount code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/admin/discount-codes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, minOrderAmount, maxUses, expiresAt, active } = req.body;

    if (!code || !type || value == null) {
      return res.status(400).json({ success: false, message: 'Κωδικός, τύπος και αξία είναι υποχρεωτικά' });
    }

    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Τύπος πρέπει να είναι percentage ή fixed' });
    }

    if (type === 'percentage' && (Number(value) < 0 || Number(value) > 100)) {
      return res.status(400).json({ success: false, message: 'Ποσοστό πρέπει να είναι 0-100' });
    }

    const [existing] = await db.query(
      'SELECT id FROM discount_codes WHERE code = ? AND id != ?',
      [String(code).toUpperCase(), id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Ο κωδικός υπάρχει ήδη' });
    }

    const [result] = await db.query(
      `UPDATE discount_codes
       SET code = ?, type = ?, value = ?, min_order_amount = ?, max_uses = ?, expires_at = ?, active = ?
       WHERE id = ?`,
      [
        String(code).toUpperCase(),
        type,
        Number(value),
        Number(minOrderAmount || 0),
        maxUses ? Number(maxUses) : null,
        expiresAt || null,
        !!active,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ο κωδικός δεν βρέθηκε' });
    }

    res.json({ success: true, message: 'Ο κωδικός ενημερώθηκε' });
  } catch (error) {
    console.error('Update discount code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/admin/discount-codes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [usages] = await db.query(
      'SELECT COUNT(*) as count FROM discount_code_usages WHERE discount_code_id = ?',
      [id]
    );

    if (usages[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Δεν είναι δυνατή η διαγραφή — ο κωδικός έχει χρησιμοποιηθεί σε ${usages[0].count} παραγγελία(-ές). Απενεργοποιήστε τον αντί να τον διαγράψετε.`
      });
    }

    await db.query('DELETE FROM discount_codes WHERE id = ?', [id]);
    res.json({ success: true, message: 'Κωδικός διαγράφηκε' });
  } catch (error) {
    console.error('Delete discount code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
