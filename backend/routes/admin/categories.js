const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken, isAdmin } = require('../../middleware/auth');

router.get('/admin/categories', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT c.id, c.name, c.created_at,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Admin get categories error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.post('/admin/categories', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Το όνομα κατηγορίας είναι υποχρεωτικό' });
    }

    const trimmedName = String(name).trim();

    const [existing] = await db.query('SELECT id FROM categories WHERE name = ?', [trimmedName]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Η κατηγορία υπάρχει ήδη' });
    }

    const [result] = await db.query(
      'INSERT INTO categories (name) VALUES (?)',
      [trimmedName]
    );

    res.status(201).json({ success: true, message: 'Η κατηγορία δημιουργήθηκε επιτυχώς', categoryId: result.insertId });
  } catch (error) {
    console.error('Admin create category error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.put('/admin/categories/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Το όνομα κατηγορίας είναι υποχρεωτικό' });
    }

    const trimmedName = String(name).trim();

    const [existing] = await db.query('SELECT id FROM categories WHERE name = ? AND id != ?', [trimmedName, categoryId]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Η κατηγορία υπάρχει ήδη' });
    }

    const [result] = await db.query(
      'UPDATE categories SET name = ? WHERE id = ?',
      [trimmedName, categoryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Η κατηγορία δεν βρέθηκε' });
    }

    res.json({ success: true, message: 'Η κατηγορία ενημερώθηκε επιτυχώς' });
  } catch (error) {
    console.error('Admin update category error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

router.delete('/admin/categories/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const categoryId = Number(req.params.id);

    const [categories] = await db.query('SELECT id, name FROM categories WHERE id = ?', [categoryId]);
    if (categories.length === 0) {
      return res.status(404).json({ success: false, message: 'Η κατηγορία δεν βρέθηκε' });
    }

    const [products] = await db.query('SELECT COUNT(*) as count FROM products WHERE category_id = ?', [categoryId]);
    if (products[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Δεν είναι δυνατή η διαγραφή. Χρησιμοποιείται από ${products[0].count} προϊόν(τα).`
      });
    }

    await db.query('DELETE FROM categories WHERE id = ?', [categoryId]);
    res.json({ success: true, message: `Η κατηγορία "${categories[0].name}" διαγράφηκε επιτυχώς` });
  } catch (error) {
    console.error('Admin delete category error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα διακομιστή. Δοκίμασε ξανά.' });
  }
});

module.exports = router;
