const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent,
        MAX(o.created_at) AS last_order_at
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      GROUP BY u.id
      ORDER BY order_count DESC, u.created_at DESC
    `);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
