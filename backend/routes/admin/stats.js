const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [ordersCount] = await db.query('SELECT COUNT(*) as total FROM orders');
    const [revenue] = await db.query('SELECT SUM(total_amount) as total FROM orders WHERE status != "cancelled"');
    const [usersCount] = await db.query('SELECT COUNT(*) as total FROM users');
    const [productsCount] = await db.query('SELECT COUNT(*) as total FROM products');
    const [pendingOrders] = await db.query(`SELECT COUNT(*) as total FROM orders WHERE status = 'pending'`);
    const [pendingPayments] = await db.query(`SELECT COUNT(*) as total FROM orders WHERE payment_status = 'pending' AND payment_method = 'bank_transfer' AND status != 'cancelled'`);
    const [pendingReturns] = await db.query(`SELECT COUNT(*) as total FROM return_requests WHERE status = 'pending'`);

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
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
