const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

router.get('/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id, p.name, p.description, p.price, p.stock,
        p.image_url, p.category_id, p.created_at,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, products: rows });
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error('Admin get product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image_url, sizes } = req.body;

    if (!name || !price || stock == null) {
      return res.status(400).json({ success: false, message: 'Το όνομα, η τιμή και το απόθεμα είναι υποχρεωτικά' });
    }

    if (category_id != null) {
      const [cats] = await db.query('SELECT id FROM categories WHERE id = ?', [Number(category_id)]);
      if (cats.length === 0) {
        return res.status(400).json({ success: false, message: 'Η κατηγορία δεν βρέθηκε' });
      }
    }

    const sizesJson = Array.isArray(sizes) && sizes.length > 0 ? JSON.stringify(sizes) : null;

    const [result] = await db.query(
      `INSERT INTO products (name, description, price, stock, category_id, image_url, sizes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, Number(price), Number(stock), category_id || null, image_url || null, sizesJson]
    );

    res.status(201).json({ success: true, message: 'Το προϊόν δημιουργήθηκε επιτυχώς', productId: result.insertId });
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { name, description, price, stock, category_id, image_url, sizes } = req.body;

    if (!name || !price || stock == null) {
      return res.status(400).json({ success: false, message: 'Το όνομα, η τιμή και το απόθεμα είναι υποχρεωτικά' });
    }

    if (category_id != null) {
      const [cats] = await db.query('SELECT id FROM categories WHERE id = ?', [Number(category_id)]);
      if (cats.length === 0) {
        return res.status(400).json({ success: false, message: 'Η κατηγορία δεν βρέθηκε' });
      }
    }

    const sizesJson = Array.isArray(sizes) && sizes.length > 0 ? JSON.stringify(sizes) : null;

    const [result] = await db.query(
      `UPDATE products
       SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, image_url = ?, sizes = ?
       WHERE id = ?`,
      [name, description || null, Number(price), Number(stock), category_id || null, image_url || null, sizesJson, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    res.json({ success: true, message: 'Το προϊόν ενημερώθηκε επιτυχώς' });
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const [products] = await db.query('SELECT id, name FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    const productName = products[0].name;

    const [orderItems] = await db.query(
      'SELECT COUNT(*) as count FROM order_items WHERE product_id = ?',
      [productId]
    );

    if (orderItems[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Δεν είναι δυνατή η διαγραφή του "${productName}". Χρησιμοποιείται σε ${orderItems[0].count} παραγγελία(-ές). Μπορείτε να το σημειώσετε ως εξαντλημένο.`
      });
    }

    const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    return res.json({ success: true, message: `Το προϊόν "${productName}" διαγράφηκε επιτυχώς!` });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(400).json({ success: false, message: 'Δεν είναι δυνατή η διαγραφή γιατί το προϊόν χρησιμοποιείται ήδη σε υπάρχουσες παραγγελίες.' });
    }
    return res.status(500).json({ success: false, message: 'Αποτυχία διαγραφής προϊόντος. Παρακαλώ δοκιμάστε ξανά.' });
  }
});

router.get('/admin/products/:id/images', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [images] = await db.query(
      'SELECT id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC',
      [productId]
    );
    res.json({ success: true, images });
  } catch (error) {
    console.error('Gallery get error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/admin/products/:id/images', authenticateToken, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const [products] = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Δεν επιλέχθηκε αρχείο' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const [countRows] = await db.query(
      'SELECT COUNT(*) as count FROM product_images WHERE product_id = ?',
      [productId]
    );
    const sortOrder = countRows[0].count;

    const [result] = await db.query(
      'INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)',
      [productId, imageUrl, sortOrder]
    );

    res.status(201).json({ success: true, image: { id: result.insertId, image_url: imageUrl, sort_order: sortOrder } });
  } catch (error) {
    console.error('Gallery upload error:', error);
    res.status(500).json({ success: false, message: 'Αποτυχία ανεβάσματος εικόνας' });
  }
});

router.delete('/admin/products/:id/images/:imageId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const imageId = Number(req.params.imageId);

    const [result] = await db.query(
      'DELETE FROM product_images WHERE id = ? AND product_id = ?',
      [imageId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Η εικόνα δεν βρέθηκε' });
    }

    res.json({ success: true, message: 'Η εικόνα διαγράφηκε' });
  } catch (error) {
    console.error('Gallery delete error:', error);
    res.status(500).json({ success: false, message: 'Αποτυχία διαγραφής εικόνας' });
  }
});

router.post('/upload-image', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Δεν επιλέχθηκε αρχείο' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl, message: 'Η εικόνα ανέβηκε επιτυχώς' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Αποτυχία ανεβάσματος αρχείου' });
  }
});

module.exports = router;
