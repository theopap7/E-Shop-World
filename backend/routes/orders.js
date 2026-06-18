const express = require('express');
const router = express.Router();
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.post('/orders', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  const {
    items,
    recipientName,
    phone,
    shipping,
    shippingMethod,
    paymentMethod,
    discountCode
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρα δεδομένα παραγγελίας (items)' });
  }

  if (!recipientName || !String(recipientName).trim()) {
    return res.status(400).json({ success: false, message: 'Λείπει το ονοματεπώνυμο παραλήπτη' });
  }

  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ success: false, message: 'Λείπει το τηλέφωνο' });
  }

  const ship = shipping || {};
  if (shippingMethod !== 'pickup' && (!ship.city || !ship.zip || !ship.address1)) {
    return res.status(400).json({ success: false, message: 'Λείπει διεύθυνση αποστολής (πόλη/ΤΚ/διεύθυνση)' });
  }

  const allowedShipping = new Set(['courier_standard', 'courier_express', 'pickup']);
  if (!allowedShipping.has(shippingMethod)) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρος τρόπος αποστολής' });
  }

  const allowedPayment = new Set(['cod', 'card_mock', 'bank_transfer']);
  if (!allowedPayment.has(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρος τρόπος πληρωμής' });
  }

  for (const item of items) {
    const { productId, quantity } = item;
    if (!productId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο order item' });
    }
  }

  let subtotal = 0;

  const shippingCost =
    shippingMethod === 'courier_express' ? 6.00 :
    shippingMethod === 'courier_standard' ? 3.00 :
    0.00;

  const paymentStatus = paymentMethod === 'card_mock' ? 'paid' : 'pending';

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const validatedItems = [];
    for (const item of items) {
      const { productId, quantity } = item;
      const q = Number(quantity);

      const [productRows] = await conn.query(
        'SELECT id, price, stock, name FROM products WHERE id = ? FOR UPDATE',
        [Number(productId)]
      );

      if (productRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
      }

      const product = productRows[0];

      if (product.stock < q) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Ανεπαρκές απόθεμα για "${product.name}" (διαθέσιμο: ${product.stock})`
        });
      }

      validatedItems.push({ productId: Number(productId), quantity: q, unitPrice: Number(product.price), size: item.size || null });
      subtotal += q * Number(product.price);
    }
    subtotal = Number(subtotal.toFixed(2));

    let finalDiscountCode = null;
    let discountAmount = 0;
    let discountCodeId = null;

    if (discountCode && String(discountCode).trim()) {
      const code = String(discountCode).trim().toUpperCase();

      const [rows] = await conn.query(
        `SELECT * FROM discount_codes WHERE code = ? AND active = TRUE FOR UPDATE`,
        [code]
      );

      if (!rows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Μη έγκυρος κωδικός έκπτωσης' });
      }

      const d = rows[0];
      discountCodeId = d.id;

      const [usage] = await conn.query(
        `SELECT id FROM discount_code_usages WHERE user_id = ? AND discount_code_id = ?`,
        [userId, discountCodeId]
      );

      if (usage.length > 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Έχεις ήδη χρησιμοποιήσει αυτόν τον κωδικό έκπτωσης' });
      }

      if (d.expires_at && new Date(d.expires_at) < new Date()) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Ο κωδικός έχει λήξει' });
      }

      if (d.max_uses !== null && Number(d.used_count) >= Number(d.max_uses)) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Ο κωδικός έχει εξαντληθεί' });
      }

      if (subtotal < Number(d.min_order_amount)) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Ελάχιστο ποσό παραγγελίας: ${d.min_order_amount}€` });
      }

      if (d.type === 'percentage') {
        discountAmount = (subtotal * Number(d.value)) / 100;
      } else if (d.type === 'fixed') {
        discountAmount = Math.min(Number(d.value), subtotal);
      } else {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Μη έγκυρος τύπος έκπτωσης' });
      }

      discountAmount = Number(discountAmount.toFixed(2));
      finalDiscountCode = d.code;
    }

    const computedTotal = Number((subtotal + shippingCost - discountAmount).toFixed(2));

    const [orderResult] = await conn.query(
      `INSERT INTO orders (
         user_id, total_amount, status, recipient_name, phone,
         ship_country, ship_city, ship_zip, ship_address1, ship_notes,
         shipping_method, shipping_cost, payment_method, payment_status,
         subtotal, floor, discount_code, discount_amount
       ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, computedTotal,
        recipientName.trim(), String(phone).trim(),
        ship.country || 'GR', ship.city, ship.zip, ship.address1, ship.notes || null,
        shippingMethod, shippingCost,
        paymentMethod, paymentStatus,
        subtotal, ship.floor || null,
        finalDiscountCode, discountAmount
      ]
    );

    const orderId = orderResult.insertId;

    for (const item of validatedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, size) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.unitPrice, item.size || null]
      );
      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }

    if (finalDiscountCode && discountCodeId) {
      await conn.query(
        `UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?`,
        [finalDiscountCode]
      );
      await conn.query(
        `INSERT INTO discount_code_usages (user_id, discount_code_id, order_id) VALUES (?, ?, ?)`,
        [userId, discountCodeId, orderId]
      );
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Η παραγγελία δημιουργήθηκε',
      orderId,
      subtotal,
      shippingCost,
      discountAmount,
      discountCode: finalDiscountCode,
      totalAmount: computedTotal,
      paymentStatus
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: 'Σφάλμα κατά τη δημιουργία παραγγελίας' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT
         o.id, o.total_amount, o.status, o.created_at,
         o.recipient_name, o.phone,
         o.ship_city, o.ship_zip, o.ship_address1,
         o.shipping_method, o.shipping_cost,
         o.payment_method, o.payment_status,
         rr.status AS return_status
       FROM orders o
       LEFT JOIN return_requests rr ON rr.order_id = o.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, orders: rows });
  } catch (error) {
    console.error('My orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.orderId);

    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο ID παραγγελίας' });
    }

    const [orders] = await db.query(
      `SELECT
         id, user_id, total_amount, status, created_at,
         subtotal, shipping_cost, shipping_method,
         payment_method, payment_status,
         recipient_name, phone,
         ship_country, ship_city, ship_zip, ship_address1, ship_notes, floor,
         discount_code, discount_amount
       FROM orders
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    const order = orders[0];

    const [items] = await db.query(
      `SELECT
         oi.product_id,
         p.name AS product_name,
         oi.quantity,
         oi.unit_price,
         oi.size,
         (oi.quantity * oi.unit_price) AS line_total,
         p.stock,
         p.image_url
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );

    const [returnRows] = await db.query(
      'SELECT id, status, reason, admin_note, created_at FROM return_requests WHERE order_id = ?',
      [orderId]
    );
    const returnRequest = returnRows.length ? returnRows[0] : null;

    return res.json({ success: true, order, items, returnRequest });
  } catch (error) {
    console.error('Order details error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/orders/:id/return', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const orderId = Number(req.params.id);
  const { reason, items } = req.body;

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: 'Παρακαλώ συμπλήρωσε τον λόγο επιστροφής' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Επίλεξε τουλάχιστον ένα προϊόν για επιστροφή' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT status FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, userId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    if (rows[0].status !== 'delivered') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Μπορείτε να ζητήσετε επιστροφή μόνο για παραδομένες παραγγελίες' });
    }

    const [orderItems] = await conn.query(
      `SELECT oi.product_id, oi.quantity, oi.unit_price, p.name AS product_name
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    const orderItemMap = {};
    for (const oi of orderItems) {
      orderItemMap[oi.product_id] = oi;
    }

    let refundAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const productId = Number(item.productId);
      const qty = Number(item.quantity);
      const oi = orderItemMap[productId];

      if (!oi) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Προϊόν ${productId} δεν ανήκει σε αυτή την παραγγελία` });
      }
      if (qty < 1 || qty > oi.quantity) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Μη έγκυρη ποσότητα για "${oi.product_name}"` });
      }

      refundAmount += qty * Number(oi.unit_price);
      validatedItems.push({ productId, productName: oi.product_name, quantity: qty, unitPrice: Number(oi.unit_price) });
    }

    refundAmount = Number(refundAmount.toFixed(2));

    const [result] = await conn.query(
      'INSERT INTO return_requests (order_id, user_id, reason, refund_amount) VALUES (?, ?, ?, ?)',
      [orderId, userId, String(reason).trim(), refundAmount]
    );

    const returnRequestId = result.insertId;

    for (const item of validatedItems) {
      await conn.query(
        'INSERT INTO return_request_items (return_request_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
        [returnRequestId, item.productId, item.productName, item.quantity, item.unitPrice]
      );
    }

    await conn.commit();
    return res.json({ success: true, message: 'Το αίτημα επιστροφής υποβλήθηκε επιτυχώς' });
  } catch (error) {
    if (conn) await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Έχετε ήδη υποβάλει αίτημα επιστροφής για αυτή την παραγγελία' });
    }
    console.error('Return request error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/orders/:id/cancel', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId)) {
    return res.status(400).json({ success: false, message: 'Μη έγκυρο ID παραγγελίας' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, user_id, status, payment_status FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, userId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    const order = rows[0];

    if (order.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Μπορείτε να ακυρώσετε μόνο παραγγελίες σε αναμονή' });
    }

    const newPaymentStatus = order.payment_status === 'paid' ? 'refunded' : 'cancelled';
    await conn.query(
      `UPDATE orders SET status = 'cancelled', payment_status = ? WHERE id = ?`,
      [newPaymentStatus, orderId]
    );

    const [items] = await conn.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );
    for (const item of items) {
      await conn.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    const [orderData] = await conn.query(
      'SELECT discount_code FROM orders WHERE id = ?',
      [orderId]
    );
    if (orderData[0]?.discount_code) {
      await conn.query(
        `UPDATE discount_codes SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?`,
        [orderData[0].discount_code]
      );
      await conn.query(
        `DELETE FROM discount_code_usages WHERE order_id = ?`,
        [orderId]
      );
    }

    await conn.commit();
    return res.json({ success: true, message: 'Η παραγγελία ακυρώθηκε επιτυχώς' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Cancel order error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/orders/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { id: userId, role } = req.user;

    let query = `
      SELECT o.*, u.first_name, u.last_name, u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `;
    const params = [orderId];
    if (role !== 'admin') { query += ' AND o.user_id = ?'; params.push(userId); }

    const [orders] = await db.query(query, params);
    if (!orders.length) return res.status(403).json({ message: 'Δεν επιτρέπεται η πρόσβαση σε αυτή την παραγγελία' });

    const order = orders[0];

    const [items] = await db.query(`
      SELECT oi.quantity, oi.unit_price AS price, p.name AS title
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [orderId]);

    const paymentMethodMap = { cod: 'Αντικαταβολή', card_mock: 'Κάρτα', bank_transfer: 'Τραπεζική Μεταφορά' };
    const shippingMethodMap = { courier_standard: 'Τυπική Αποστολή', courier_express: 'Γρήγορη Αποστολή', pickup: 'Παραλαβή από το Κατάστημα' };

    const doc = new PDFDocument({ margin: 50 });
    doc.registerFont('Roboto', path.join(__dirname, '..', 'fonts', 'Roboto-Regular.ttf'));
    doc.registerFont('RobotoBold', path.join(__dirname, '..', 'fonts', 'Roboto-Bold.ttf'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order-${order.id}.pdf`);
    doc.pipe(res);

    const paymentMethod = paymentMethodMap[order.payment_method] || order.payment_method;
    const shippingMethod = shippingMethodMap[order.shipping_method] || order.shipping_method;

    doc.font('RobotoBold').fontSize(24).text('ECommerce', 50, 45);
    doc.font('Roboto').fontSize(10).text('support@ecommerce.com', 50, 70).text('www.ecommerce.com', 50, 85);
    doc.font('RobotoBold').fontSize(20).text('ΑΠΟΔΕΙΞΗ ΠΑΡΑΓΓΕΛΙΑΣ', 320, 50);
    doc.moveTo(50, 105).lineTo(550, 105).lineWidth(0.5).stroke();

    doc.font('RobotoBold').fontSize(11).text('ΣΤΟΙΧΕΙΑ ΠΑΡΑΓΓΕΛΙΑΣ', 50, 120);
    doc.font('Roboto').fontSize(10)
      .text(`Αριθμός: ${order.id}`, 50, 136)
      .text(`Ημερομηνία: ${new Date(order.created_at).toLocaleDateString('el-GR')}`, 50, 151)
      .text(`Email: ${order.email}`, 50, 166, { width: 230, lineBreak: false })
      .text(`Τρόπος Πληρωμής: ${paymentMethod}`, 50, 181, { width: 230, lineBreak: false })
      .text(`Τρόπος Αποστολής: ${shippingMethod}`, 50, 196, { width: 230, lineBreak: false });

    doc.font('RobotoBold').fontSize(11).text('ΔΙΕΥΘΥΝΣΗ ΑΠΟΣΤΟΛΗΣ', 300, 120);
    doc.font('Roboto').fontSize(10)
      .text(`Ονοματεπώνυμο: ${order.recipient_name}`, 300, 136);

    if (order.shipping_method === 'pickup') {
      doc.text('Παραλαβή από το κατάστημα', 300, 151, { width: 230 });
      doc.text(`Τηλέφωνο: ${order.phone}`, 300, 166, { width: 230, lineBreak: false });
    } else if (order.floor) {
      doc.text(`Διεύθυνση: ${order.ship_address1}`, 300, 151, { width: 230, lineBreak: false });
      doc.text(`Όροφος: ${order.floor}`, 300, 166, { width: 230, lineBreak: false });
      doc.text(`ΤΚ: ${order.ship_zip}`, 300, 181, { width: 230, lineBreak: false });
      doc.text(`Πόλη: ${order.ship_city}`, 300, 196, { width: 230, lineBreak: false });
      doc.text(`Χώρα: ${order.ship_country}`, 300, 211, { width: 230, lineBreak: false });
      doc.text(`Τηλέφωνο: ${order.phone}`, 300, 226, { width: 230, lineBreak: false });
      if (order.ship_notes) doc.text(`Σημειώσεις: ${order.ship_notes}`, 300, 241, { width: 230 });
    } else {
      doc.text(`Διεύθυνση: ${order.ship_address1}`, 300, 151, { width: 230, lineBreak: false });
      doc.text(`ΤΚ: ${order.ship_zip}`, 300, 166, { width: 230, lineBreak: false });
      doc.text(`Πόλη: ${order.ship_city}`, 300, 181, { width: 230, lineBreak: false });
      doc.text(`Χώρα: ${order.ship_country}`, 300, 196, { width: 230, lineBreak: false });
      doc.text(`Τηλέφωνο: ${order.phone}`, 300, 211, { width: 230, lineBreak: false });
      if (order.ship_notes) doc.text(`Σημειώσεις: ${order.ship_notes}`, 300, 226, { width: 230 });
    }

    let tableY = order.shipping_method === 'pickup' ? 260 : (order.ship_notes ? 360 : (order.floor ? 320 : 305));

    const cols = { product: 60, qty: 330, price: 410, total: 490 };

    doc.rect(50, tableY - 5, 500, 20).fill('#f2f2f2').fillColor('black');
    doc.font('RobotoBold')
      .text('Προϊόν', cols.product, tableY)
      .text('Ποσότητα', cols.qty, tableY, { width: 60, align: 'right' })
      .text('Τιμή', cols.price, tableY, { width: 60, align: 'right' })
      .text('Σύνολο', cols.total, tableY, { width: 60, align: 'right' });

    tableY += 25;
    doc.moveTo(50, tableY - 5).lineTo(550, tableY - 5).stroke();

    doc.font('Roboto').fontSize(12);
    items.forEach(({ title, quantity, price }) => {
      doc.text(title, cols.product, tableY)
        .text(quantity.toString(), cols.qty, tableY, { width: 60, align: 'right' })
        .text(`€${Number(price).toFixed(2)}`, cols.price, tableY, { width: 60, align: 'right' })
        .text(`€${(quantity * price).toFixed(2)}`, cols.total, tableY, { width: 60, align: 'right' });
      tableY += 28;
    });

    tableY += 20;
    doc.moveTo(330, tableY).lineTo(550, tableY).stroke();
    tableY += 20;

    const summaryRow = (label, value, y) => {
      doc.fontSize(12).text(label, 330, y).text(value, 450, y, { width: 100, align: 'right' });
    };

    summaryRow('Προϊόντα', `€${Number(order.subtotal).toFixed(2)}`, tableY);
    tableY += 20;
    summaryRow('Μεταφορικά', `€${Number(order.shipping_cost).toFixed(2)}`, tableY);
    tableY += 20;

    if (order.discount_amount > 0) {
      summaryRow(`Έκπτωση (${order.discount_code})`, `-€${Number(order.discount_amount).toFixed(2)}`, tableY);
      tableY += 20;
    }

    doc.moveTo(330, tableY).lineTo(550, tableY).stroke();
    tableY += 18;

    doc.font('RobotoBold').fontSize(14)
      .text('Σύνολο Παραγγελίας', 330, tableY, { width: 160, lineBreak: false })
      .text(`€${Number(order.total_amount).toFixed(2)}`, 470, tableY, { width: 80, align: 'right' });

    tableY += 30;
    doc.moveTo(50, tableY).lineTo(550, tableY).lineWidth(0.5).strokeColor('#cccccc').stroke();
    tableY += 15;
    doc.font('Roboto').fontSize(9)
      .fillColor('#888888')
      .text('Ευχαριστούμε για την παραγγελία σας!', 50, tableY, { align: 'center', width: 500 })
      .text('Για οποιαδήποτε απορία επικοινωνήστε μαζί μας στο support@ecommerce.com', 50, tableY + 13, { align: 'center', width: 500 });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
