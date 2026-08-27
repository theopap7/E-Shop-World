const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/wishlist', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.stock, p.image_url,
              p.category_id, p.created_at, p.sizes,
              c.name AS category_name,
              ROUND(AVG(r.rating), 1) AS average_rating,
              COUNT(r.id) AS review_count
       FROM wishlists w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN reviews r ON r.product_id = p.id
       WHERE w.user_id = ?
       GROUP BY p.id, p.name, p.description, p.price, p.stock, p.image_url,
                p.category_id, p.created_at, p.sizes, c.name, w.created_at
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/wishlist/:productId', authenticateToken, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID' });

  try {
    const [product] = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product.length) return res.status(404).json({ success: false, message: 'Product not found' });

    await db.query('INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)', [req.user.id, productId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/wishlist/:productId', authenticateToken, async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID' });

  try {
    await db.query('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?', [req.user.id, productId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/wishlist', authenticateToken, async (req, res) => {
  try {
    await db.query('DELETE FROM wishlists WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
