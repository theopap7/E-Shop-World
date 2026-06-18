const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         o.id, o.total_amount, o.status, o.created_at,
         o.recipient_name, o.phone, o.payment_status,
         u.email as user_email, u.first_name, u.last_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, orders: rows });
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/orders/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const [orders] = await db.query(
      `SELECT
         o.id, o.user_id, o.total_amount, o.status, o.created_at,
         o.subtotal, o.shipping_cost, o.shipping_method,
         o.payment_method, o.payment_status,
         o.recipient_name, o.phone,
         o.ship_country, o.ship_city, o.ship_zip, o.ship_address1, o.ship_notes, o.floor,
         o.discount_code, o.discount_amount,
         u.email, u.first_name, u.last_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    const order = orders[0];

    const [items] = await db.query(
      `SELECT
         oi.product_id, p.name AS product_name,
         oi.quantity, oi.unit_price, oi.size,
         (oi.quantity * oi.unit_price) AS line_total
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );

    const [returnRows] = await db.query(
      'SELECT * FROM return_requests WHERE order_id = ? LIMIT 1',
      [orderId]
    );
    const returnRequest = returnRows[0] ?? null;

    res.json({ success: true, order, items, returnRequest });
  } catch (error) {
    console.error('Admin order details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/admin/orders/:id/status', authenticateToken, isAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body;

  const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρη κατάσταση παραγγελίας' });
  }

  const allowedTransitions = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
  };

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT status, payment_method, payment_status FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    const currentStatus = rows[0].status;
    const paymentMethod = rows[0].payment_method;
    const currentPaymentStatus = rows[0].payment_status;

    if (!allowedTransitions[currentStatus].includes(status)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Δεν επιτρέπεται η αλλαγή κατάστασης από ${currentStatus} σε ${status}` });
    }

    if (status === 'delivered' && paymentMethod === 'cod') {
      await conn.query(`UPDATE orders SET status = ?, payment_status = 'paid' WHERE id = ?`, [status, orderId]);
    } else if (status === 'cancelled' && currentPaymentStatus === 'paid') {
      await conn.query(`UPDATE orders SET status = ?, payment_status = 'refunded' WHERE id = ?`, [status, orderId]);
    } else if (status === 'cancelled' && currentPaymentStatus === 'pending') {
      await conn.query(`UPDATE orders SET status = ?, payment_status = 'cancelled' WHERE id = ?`, [status, orderId]);
    } else {
      await conn.query(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
    }

    if (status === 'cancelled') {
      const [orderItems] = await conn.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );
      for (const item of orderItems) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      const [orderData] = await conn.query('SELECT discount_code FROM orders WHERE id = ?', [orderId]);
      if (orderData[0]?.discount_code) {
        await conn.query(
          'UPDATE discount_codes SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?',
          [orderData[0].discount_code]
        );
        await conn.query('DELETE FROM discount_code_usages WHERE order_id = ?', [orderId]);
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Η κατάσταση παραγγελίας ενημερώθηκε' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Admin update order status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/admin/orders/:id/confirm-payment', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const [rows] = await db.query('SELECT payment_status FROM orders WHERE id = ?', [orderId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    if (rows[0].payment_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Η πληρωμή δεν είναι σε εκκρεμότητα' });
    }

    await db.query(`UPDATE orders SET payment_status = 'paid' WHERE id = ?`, [orderId]);

    res.json({ success: true, message: 'Η πληρωμή επιβεβαιώθηκε' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/orders/:id/csv', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id: orderId } = req.params;

    const [rows] = await db.query(`
      SELECT o.id, o.created_at, o.status, o.payment_method, o.payment_status,
             o.total_amount, o.subtotal, o.shipping_cost, o.shipping_method,
             o.ship_address1, o.ship_city, o.ship_zip,
             o.ship_country, o.floor, o.ship_notes,
             o.recipient_name, o.phone,
             u.first_name, u.last_name, u.email
      FROM orders o JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [orderId]);

    if (!rows.length) return res.status(404).json({ message: 'Η παραγγελία δεν βρέθηκε' });

    const order = rows[0];

    const [items] = await db.query(`
      SELECT p.name, oi.quantity, oi.unit_price
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [orderId]);

    const paymentMethodMap = { cod: 'Αντικαταβολή', card_mock: 'Πληρωμή με Κάρτα', bank_transfer: 'Τραπεζική Μεταφορά' };
    const paymentStatusMap = { paid: 'Πληρωμένη', unpaid: 'Μη πληρωμένη', pending: 'Σε εκκρεμότητα' };
    const statusMap = { pending: 'Σε αναμονή', processing: 'Σε επεξεργασία', shipped: 'Απεστάλη', delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε' };
    const shippingMethodMap = { courier_standard: 'Τυπική Αποστολή', courier_express: 'Γρήγορη Αποστολή', pickup: 'Παραλαβή από το Κατάστημα' };

    const q = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const eur = (val) => `€${Number(val).toFixed(2)}`;
    const date = new Date(order.created_at).toLocaleString('el-GR');
    const itemSummary = items.map(({ name, quantity, unit_price }) =>
      `${name} x${quantity} (${eur(unit_price)})`
    ).join(' | ');

    const csv = [
      [
        'Αριθμός', 'Ημερομηνία', 'Κατάσταση',
        'Πελάτης', 'Email', 'Τηλέφωνο',
        'Τρόπος Αποστολής', 'Κόστος Μεταφορικών', 'Τρόπος Πληρωμής', 'Κατάσταση Πληρωμής',
        'Διεύθυνση', 'Πόλη', 'ΤΚ', 'Χώρα', 'Όροφος', 'Σημειώσεις',
        'Προϊόντα', 'Κόστος Προϊόντων', 'Μεταφορικά', 'Σύνολο'
      ].join(','),
      [
        order.id, q(date), q(statusMap[order.status] || order.status),
        q(order.recipient_name), q(order.email), q(order.phone),
        q(shippingMethodMap[order.shipping_method] || order.shipping_method), eur(order.shipping_cost),
        q(paymentMethodMap[order.payment_method] || order.payment_method),
        q(paymentStatusMap[order.payment_status?.toLowerCase()] || order.payment_status),
        q(order.ship_address1), q(order.ship_city), q(order.ship_zip),
        q(order.ship_country), q(order.floor), q(order.ship_notes),
        q(itemSummary), eur(order.subtotal), eur(order.shipping_cost), eur(order.total_amount)
      ].join(',')
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=paraggelia-${order.id}.csv`);
    res.send('﻿' + csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
