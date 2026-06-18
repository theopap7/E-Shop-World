const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/reviews/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [reviews] = await db.query(`
      SELECT
        r.id, r.rating, r.comment, r.created_at,
        r.product_id, r.user_id,
        p.name AS product_name,
        p.image_url AS product_image
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);

    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/reviews/:productId', async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    const [reviews] = await db.query(`
      SELECT
        r.id, r.rating, r.comment, r.created_at, r.user_id,
        u.first_name, u.last_name
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `, [productId]);

    const [avgResult] = await db.query(`
      SELECT ROUND(AVG(rating), 1) as average, COUNT(*) as total
      FROM reviews WHERE product_id = ?
    `, [productId]);

    res.json({
      success: true,
      reviews,
      average: avgResult[0].average || 0,
      total: avgResult[0].total || 0
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/reviews/:productId', authenticateToken, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const userId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Η βαθμολογία πρέπει να είναι μεταξύ 1 και 5' });
    }

    const [orders] = await db.query(`
      SELECT o.id FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'
      LIMIT 1
    `, [userId, productId]);

    if (orders.length === 0) {
      return res.status(403).json({ success: false, message: 'Μπορείτε να αξιολογήσετε μόνο προϊόντα που έχετε αγοράσει και παραλάβει.' });
    }

    const [existing] = await db.query(
      'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?',
      [productId, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Έχετε ήδη αξιολογήσει αυτό το προϊόν.' });
    }

    await db.query(
      'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [productId, userId, rating, comment || null]
    );

    res.status(201).json({ success: true, message: 'Η κριτική υποβλήθηκε με επιτυχία!' });
  } catch (error) {
    console.error('Post review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const userId = req.user.id;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Η βαθμολογία πρέπει να είναι μεταξύ 1 και 5' });
    }

    const [reviews] = await db.query('SELECT * FROM reviews WHERE id = ?', [reviewId]);

    if (reviews.length === 0) {
      return res.status(404).json({ success: false, message: 'Η κριτική δεν βρέθηκε' });
    }

    if (reviews[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Δεν έχετε δικαίωμα επεξεργασίας αυτής της κριτικής' });
    }

    await db.query(
      'UPDATE reviews SET rating = ?, comment = ? WHERE id = ?',
      [rating, comment || null, reviewId]
    );

    res.json({ success: true, message: 'Η κριτική ενημερώθηκε επιτυχώς!' });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const userId = req.user.id;
    const userRole = req.user.role;

    const [reviews] = await db.query('SELECT * FROM reviews WHERE id = ?', [reviewId]);

    if (reviews.length === 0) {
      return res.status(404).json({ success: false, message: 'Η κριτική δεν βρέθηκε' });
    }

    if (reviews[0].user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Δεν έχετε δικαίωμα διαγραφής αυτής της κριτικής' });
    }

    await db.query('DELETE FROM reviews WHERE id = ?', [reviewId]);

    res.json({ success: true, message: 'Η κριτική διαγράφηκε επιτυχώς' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
