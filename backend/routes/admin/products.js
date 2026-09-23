const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');
const { upload, verifyImageSignature, saveImage, deleteImage } = require('../../middleware/upload');

router.get('/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id, p.name, p.description, p.price, p.stock,
        p.image_url, p.category_id, p.created_at,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.id ASC
    `);
    res.json({ success: true, products: rows });
  } catch (error) {
    console.error('Admin get products error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.get('/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    const product = rows[0];

    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      const [sizeRows] = await db.query(
        'SELECT size, stock FROM product_size_stock WHERE product_id = ?',
        [productId]
      );
      product.sizeStock = Object.fromEntries(sizeRows.map(r => [r.size, r.stock]));
    }

    res.json({ success: true, product });
  } catch (error) {
    console.error('Admin get product error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

// When sizes are given, per-size quantities (sizeStock) replace the flat
// stock number as the source of truth — the total is derived from them.
function resolveStock({ sizes, stock, sizeStock }) {
  if (!Array.isArray(sizes) || sizes.length === 0) {
    const stockNum = Number(stock);
    if (stock == null || !Number.isFinite(stockNum) || stockNum < 0) return null;
    return { stockNum, perSize: null };
  }

  const perSize = {};
  let total = 0;
  for (const size of sizes) {
    const qty = Number(sizeStock?.[size] ?? 0);
    if (!Number.isFinite(qty) || qty < 0) return null;
    perSize[size] = qty;
    total += qty;
  }
  return { stockNum: total, perSize };
}

router.post('/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image_url, sizes, sizeStock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Το όνομα και η τιμή είναι υποχρεωτικά' });
    }

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, message: 'Η τιμή πρέπει να είναι θετικός αριθμός' });
    }

    const resolved = resolveStock({ sizes, stock, sizeStock });
    if (!resolved) {
      return res.status(400).json({ success: false, message: 'Το απόθεμα πρέπει να είναι μη αρνητικός αριθμός' });
    }

    if (category_id != null) {
      const [cats] = await db.query('SELECT id FROM categories WHERE id = ?', [Number(category_id)]);
      if (cats.length === 0) {
        return res.status(400).json({ success: false, message: 'Η κατηγορία δεν βρέθηκε' });
      }
    }

    const sizesJson = Array.isArray(sizes) && sizes.length > 0 ? JSON.stringify(sizes) : null;

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO products (name, description, price, stock, category_id, image_url, sizes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, description || null, priceNum, resolved.stockNum, category_id || null, image_url || null, sizesJson]
      );

      if (resolved.perSize) {
        for (const [size, qty] of Object.entries(resolved.perSize)) {
          await conn.query(
            'INSERT INTO product_size_stock (product_id, size, stock) VALUES (?, ?, ?)',
            [result.insertId, size, qty]
          );
        }
      }

      await conn.commit();
      res.status(201).json({ success: true, message: 'Το προϊόν δημιουργήθηκε επιτυχώς', productId: result.insertId });
    } catch (error) {
      if (conn) await conn.rollback();
      throw error;
    } finally {
      if (conn) conn.release();
    }
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.put('/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { name, description, price, stock, category_id, image_url, sizes, sizeStock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Το όνομα και η τιμή είναι υποχρεωτικά' });
    }

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, message: 'Η τιμή πρέπει να είναι θετικός αριθμός' });
    }

    const resolved = resolveStock({ sizes, stock, sizeStock });
    if (!resolved) {
      return res.status(400).json({ success: false, message: 'Το απόθεμα πρέπει να είναι μη αρνητικός αριθμός' });
    }

    if (category_id != null) {
      const [cats] = await db.query('SELECT id FROM categories WHERE id = ?', [Number(category_id)]);
      if (cats.length === 0) {
        return res.status(400).json({ success: false, message: 'Η κατηγορία δεν βρέθηκε' });
      }
    }

    const sizesJson = Array.isArray(sizes) && sizes.length > 0 ? JSON.stringify(sizes) : null;

    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      const [result] = await conn.query(
        `UPDATE products
         SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, image_url = ?, sizes = ?
         WHERE id = ?`,
        [name, description || null, priceNum, resolved.stockNum, category_id || null, image_url || null, sizesJson, productId]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
      }

      await conn.query('DELETE FROM product_size_stock WHERE product_id = ?', [productId]);
      if (resolved.perSize) {
        for (const [size, qty] of Object.entries(resolved.perSize)) {
          await conn.query(
            'INSERT INTO product_size_stock (product_id, size, stock) VALUES (?, ?, ?)',
            [productId, size, qty]
          );
        }
      }

      await conn.commit();
      res.json({ success: true, message: 'Το προϊόν ενημερώθηκε επιτυχώς' });
    } catch (error) {
      if (conn) await conn.rollback();
      throw error;
    } finally {
      if (conn) conn.release();
    }
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.delete('/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const [products] = await db.query('SELECT id, name, image_url FROM products WHERE id = ?', [productId]);
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

    const [galleryImages] = await db.query(
      'SELECT image_url FROM product_images WHERE product_id = ?',
      [productId]
    );

    const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    deleteImage(products[0].image_url);
    galleryImages.forEach(img => deleteImage(img.image_url));

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
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.post('/admin/products/:id/images', authenticateToken, isAdmin, upload.single('image'), verifyImageSignature, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const [products] = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Δεν επιλέχθηκε αρχείο' });
    }

    const imageUrl = await saveImage(req.file);

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

    const [images] = await db.query(
      'SELECT image_url FROM product_images WHERE id = ? AND product_id = ?',
      [imageId, productId]
    );

    const [result] = await db.query(
      'DELETE FROM product_images WHERE id = ? AND product_id = ?',
      [imageId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Η εικόνα δεν βρέθηκε' });
    }

    deleteImage(images[0]?.image_url);

    res.json({ success: true, message: 'Η εικόνα διαγράφηκε' });
  } catch (error) {
    console.error('Gallery delete error:', error);
    res.status(500).json({ success: false, message: 'Αποτυχία διαγραφής εικόνας' });
  }
});

router.post('/upload-image', authenticateToken, isAdmin, upload.single('image'), verifyImageSignature, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Δεν επιλέχθηκε αρχείο' });
    }

    const imageUrl = await saveImage(req.file);
    res.json({ success: true, imageUrl, message: 'Η εικόνα ανέβηκε επιτυχώς' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Αποτυχία ανεβάσματος αρχείου' });
  }
});

module.exports = router;
