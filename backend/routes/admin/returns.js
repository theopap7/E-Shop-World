const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/returns', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT rr.id, rr.order_id, rr.reason, rr.status, rr.admin_note, rr.refund_amount, rr.created_at,
              u.first_name, u.last_name, u.email,
              o.total_amount, o.status AS order_status
       FROM return_requests rr
       JOIN users u ON u.id = rr.user_id
       JOIN orders o ON o.id = rr.order_id
       ORDER BY rr.created_at DESC`
    );

    const [itemRows] = await db.query(
      `SELECT return_request_id, product_id, product_name, quantity, unit_price
       FROM return_request_items`
    );

    const itemsByRequest = {};
    for (const item of itemRows) {
      if (!itemsByRequest[item.return_request_id]) itemsByRequest[item.return_request_id] = [];
      itemsByRequest[item.return_request_id].push(item);
    }

    const returns = rows.map(r => ({ ...r, items: itemsByRequest[r.id] || [] }));
    return res.json({ success: true, returns });
  } catch (error) {
    console.error('Admin returns error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.patch('/admin/returns/:id', authenticateToken, isAdmin, async (req, res) => {
  const returnId = Number(req.params.id);
  const { status, adminNote } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρη κατάσταση' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT rr.id, rr.order_id, rr.status AS current_status FROM return_requests rr WHERE rr.id = ? FOR UPDATE',
      [returnId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Αίτημα δεν βρέθηκε' });
    }

    const returnReq = rows[0];

    if (returnReq.current_status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Το αίτημα έχει ήδη επεξεργαστεί' });
    }

    await conn.query(
      'UPDATE return_requests SET status = ?, admin_note = ? WHERE id = ?',
      [status, adminNote?.trim() || null, returnId]
    );

    if (status === 'approved') {
      await conn.query(
        `UPDATE orders SET payment_status = 'refunded' WHERE id = ?`,
        [returnReq.order_id]
      );

      const [returnItems] = await conn.query(
        'SELECT product_id, quantity FROM return_request_items WHERE return_request_id = ?',
        [returnId]
      );
      for (const item of returnItems) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }

    await conn.commit();
    return res.json({ success: true, message: status === 'approved' ? 'Αίτημα εγκρίθηκε — stock & refund ενημερώθηκαν' : 'Αίτημα απορρίφθηκε' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Update return error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
