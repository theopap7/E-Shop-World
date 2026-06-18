const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, description, created_at FROM categories ORDER BY name ASC'
    );
    res.json({ success: true, categories: rows });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την ανάκτηση κατηγοριών' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.category_id,
        p.created_at,
        p.sizes,
        c.name AS category_name,
        ROUND(AVG(r.rating), 1) AS average_rating,
        COUNT(r.id) AS review_count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN reviews r ON r.product_id = p.id
      WHERE p.stock > 0
    `;

    const params = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
      query += ` AND c.name = ?`;
      params.push(category);
    }

    if (minPrice) {
      query += ` AND p.price >= ?`;
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      query += ` AND p.price <= ?`;
      params.push(Number(maxPrice));
    }

    query += ` GROUP BY p.id, p.name, p.description, p.price, p.stock, p.image_url, p.category_id, p.created_at, c.name`;

    if (sort === 'price_asc') {
      query += ` ORDER BY p.price ASC`;
    } else if (sort === 'price_desc') {
      query += ` ORDER BY p.price DESC`;
    } else if (sort === 'name_asc') {
      query += ` ORDER BY p.name ASC`;
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }

    const [products] = await db.query(query, params);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο ID προϊόντος' });
    }

    const [rows] = await db.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.created_at,
        p.category_id,
        p.sizes,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `, [productId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
