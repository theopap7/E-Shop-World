const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [
      [ordersCount], [revenue], [usersCount], [productsCount],
      [pendingOrders], [pendingPayments], [pendingReturns],
      [dailyOrders], [statusBreakdown], [topProducts]
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM orders'),
      db.query('SELECT SUM(total_amount) as total FROM orders WHERE status != "cancelled"'),
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as total FROM products'),
      db.query(`SELECT COUNT(*) as total FROM orders WHERE status = 'pending'`),
      db.query(`SELECT COUNT(*) as total FROM orders WHERE payment_status = 'pending' AND payment_method = 'bank_transfer' AND status != 'cancelled'`),
      db.query(`SELECT COUNT(*) as total FROM return_requests WHERE status = 'pending'`),
      db.query(`
        SELECT DATE(created_at) AS day, COUNT(*) AS orders,
          ROUND(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 2) AS revenue
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(created_at) ORDER BY day ASC
      `),
      db.query(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`),
      db.query(`
        SELECT p.name, SUM(oi.quantity) AS total_sold
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
        GROUP BY oi.product_id, p.name
        ORDER BY total_sold DESC LIMIT 5
      `)
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders: ordersCount[0].total || 0,
        totalRevenue: revenue[0].total || 0,
        totalUsers: usersCount[0].total || 0,
        totalProducts: productsCount[0].total || 0,
        pendingOrders: pendingOrders[0].total || 0,
        pendingPayments: pendingPayments[0].total || 0,
        pendingReturns: pendingReturns[0].total || 0
      },
      charts: { dailyOrders, statusBreakdown, topProducts }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/stats/charts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [[dailyOrders], [statusBreakdown], [topProducts]] = await Promise.all([
      db.query(`
        SELECT
          DATE(created_at) AS day,
          COUNT(*) AS orders,
          ROUND(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 2) AS revenue
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),
      db.query(`
        SELECT status, COUNT(*) AS count
        FROM orders
        GROUP BY status
      `),
      db.query(`
        SELECT p.name, SUM(oi.quantity) AS total_sold
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
        GROUP BY oi.product_id, p.name
        ORDER BY total_sold DESC
        LIMIT 5
      `)
    ]);

    res.json({ success: true, dailyOrders, statusBreakdown, topProducts });
  } catch (error) {
    console.error('Admin charts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
