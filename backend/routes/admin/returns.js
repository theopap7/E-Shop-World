const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const { restoreStock } = require('../../utils/stock');

router.get('/admin/returns', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT rr.id, rr.order_id, rr.reason, rr.status, rr.admin_note, rr.refund_amount, rr.created_at,
              u.first_name, u.last_name, u.email,
              o.total_amount, o.subtotal, o.discount_amount, o.status AS order_status
       FROM return_requests rr
       JOIN users u ON u.id = rr.user_id
       JOIN orders o ON o.id = rr.order_id
       ORDER BY rr.created_at DESC`
    );

    const [itemRows] = await db.query(
      `SELECT rri.id, rri.return_request_id, rri.product_id, rri.product_name, rri.quantity, rri.unit_price, rri.size, rri.status, rri.reason, p.image_url
       FROM return_request_items rri
       LEFT JOIN products p ON p.id = rri.product_id
       ORDER BY rri.id`
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
    return res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.patch('/admin/returns/:id', authenticateToken, isAdmin, async (req, res) => {
  const returnId = Number(req.params.id);
  const { items, adminNote } = req.body;

  if (!Array.isArray(items) || items.length === 0 ||
      items.some(item => !item || !Number.isInteger(Number(item.id)) || !['approved', 'rejected'].includes(item.status))) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρη απόφαση για τα προϊόντα' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT rr.id, rr.order_id, rr.status AS current_status, o.subtotal, o.discount_amount, o.total_amount
       FROM return_requests rr JOIN orders o ON o.id = rr.order_id
       WHERE rr.id = ? FOR UPDATE`,
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

    const [returnItems] = await conn.query(
      'SELECT id, product_id, quantity, unit_price, size FROM return_request_items WHERE return_request_id = ?',
      [returnId]
    );

    const decisionById = new Map(items.map(item => [Number(item.id), item.status]));
    if (decisionById.size !== returnItems.length || returnItems.some(item => !decisionById.has(item.id))) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Πρέπει να αποφασίσεις για κάθε προϊόν του αιτήματος' });
    }

    const approvedItems = returnItems.filter(item => decisionById.get(item.id) === 'approved');
    const status = approvedItems.length === returnItems.length
      ? 'approved'
      : approvedItems.length === 0 ? 'rejected' : 'partially_approved';

    const subtotal = Number(returnReq.subtotal);
    const discountRatio = subtotal > 0 ? Number(returnReq.discount_amount) / subtotal : 0;
    const approvedSubtotal = approvedItems.reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);
    const refundAmount = Math.min(
      Number((approvedSubtotal * (1 - discountRatio)).toFixed(2)),
      Number(returnReq.total_amount)
    );

    for (const item of returnItems) {
      await conn.query(
        'UPDATE return_request_items SET status = ? WHERE id = ?',
        [decisionById.get(item.id), item.id]
      );
    }

    await conn.query(
      'UPDATE return_requests SET status = ?, admin_note = ?, refund_amount = ? WHERE id = ?',
      [status, adminNote?.trim() || null, refundAmount, returnId]
    );

    if (approvedItems.length > 0) {
      // Refunds never include shipping, so compare against the item total (subtotal minus
      // discount), not total_amount — otherwise a full-item return would still look "partial".
      const itemsChargedTotal = subtotal - Number(returnReq.discount_amount);

      const [[{ totalRefunded }]] = await conn.query(
        `SELECT COALESCE(SUM(refund_amount), 0) AS totalRefunded
         FROM return_requests WHERE order_id = ? AND status IN ('approved', 'partially_approved')`,
        [returnReq.order_id]
      );

      const isFullRefund = Number(totalRefunded) >= itemsChargedTotal - 0.01;
      await conn.query(
        `UPDATE orders SET payment_status = ? WHERE id = ?`,
        [isFullRefund ? 'refunded' : 'partially_refunded', returnReq.order_id]
      );

      await restoreStock(conn, approvedItems);
    }

    await conn.commit();
    const messages = {
      approved: 'Το αίτημα εγκρίθηκε — το απόθεμα και η επιστροφή χρημάτων ενημερώθηκαν',
      partially_approved: 'Το αίτημα εγκρίθηκε μερικώς — το απόθεμα και η επιστροφή χρημάτων ενημερώθηκαν για τα εγκεκριμένα προϊόντα',
      rejected: 'Το αίτημα απορρίφθηκε'
    };
    return res.json({ success: true, status, message: messages[status] });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Update return error:', error);
    return res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
