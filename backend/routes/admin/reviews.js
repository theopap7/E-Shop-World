const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/reviews', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT
        r.id, r.rating, r.comment, r.created_at,
        r.product_id, r.user_id,
        p.name AS product_name,
        p.image_url AS product_image,
        u.first_name, u.last_name, u.email
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Admin get all reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
