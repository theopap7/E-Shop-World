const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.post('/validate-discount', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, orderTotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Κωδικός απαιτείται' });
    }

    const [rows] = await db.query(
      `SELECT * FROM discount_codes WHERE code = ? AND active = TRUE`,
      [String(code).trim().toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Μη έγκυρος κωδικός έκπτωσης' });
    }

    const discount = rows[0];

    const [usageRows] = await db.query(
      `SELECT id FROM discount_code_usages WHERE user_id = ? AND discount_code_id = ?`,
      [userId, discount.id]
    );

    if (usageRows.length > 0) {
      return res.status(400).json({ success: false, message: 'Έχεις ήδη χρησιμοποιήσει αυτόν τον κωδικό έκπτωσης' });
    }

    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Ο κωδικός έχει λήξει' });
    }

    if (discount.max_uses !== null && Number(discount.used_count) >= Number(discount.max_uses)) {
      return res.status(400).json({ success: false, message: 'Ο κωδικός έχει εξαντληθεί' });
    }

    if (Number(orderTotal) < Number(discount.min_order_amount)) {
      return res.status(400).json({ success: false, message: `Ελάχιστο ποσό παραγγελίας: ${discount.min_order_amount}€` });
    }

    let discountAmount = 0;

    if (discount.type === 'percentage') {
      discountAmount = (Number(orderTotal) * Number(discount.value)) / 100;
    } else if (discount.type === 'fixed') {
      discountAmount = Math.min(Number(discount.value), Number(orderTotal));
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      success: true,
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        amount: discountAmount
      }
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
