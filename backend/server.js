const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./db');
const PDFDocument = require('pdfkit');
const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε 10 λεπτά.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ✅ JWT middleware (protect routes)
 * Περιμένει header: Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = payload; // { id, email, role }
    next();
  });
}

/**
 * ✅ Admin middleware (only admins can access)
 */
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
  next();
}

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ===== FILE UPLOAD SETUP =====

// Δημιούργησε uploads folder αν δεν υπάρχει
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // Save στο /uploads folder
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp + original name
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

// File filter (only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);  // Accept file
  } else {
    cb(new Error('Only image files are allowed!'), false);  // Reject
  }
};

// Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB max
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Route για εγγραφή
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Το email υπάρχει ήδη' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: 'Η εγγραφή ολοκληρώθηκε επιτυχώς',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά την εγγραφή' });
  }
});

// Route για σύνδεση
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Λάθος email ή κωδικός' });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Λάθος email ή κωδικός' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Επιτυχής σύνδεση',
      token: token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Σφάλμα κατά τη σύνδεση' });
  }
});

/**
 * ✅ Profile endpoint: GET /api/me
 * Επιστρέφει τον τρέχοντα χρήστη από το token
 */
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      'SELECT id, first_name, last_name, email FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ο χρήστης δεν βρέθηκε' });
    }

    const u = rows[0];
    return res.json({
      success: true,
      user: {
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email
      }
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ success: false, message: 'Όλα τα πεδία είναι υποχρεωτικά' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρο email' });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email.toLowerCase().trim(), userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Το email χρησιμοποιείται ήδη από άλλο λογαριασμό' });
    }

    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
      [firstName.trim(), lastName.trim(), email.toLowerCase().trim(), userId]
    );

    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Το προφίλ ενημερώθηκε επιτυχώς',
      user: {
        id: userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        role: rows[0]?.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ Change password: POST /api/change-password
 * Θέλει token + currentPassword + newPassword
 */
app.post('/api/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Μη έγκυρα δεδομένα κωδικού' });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ο χρήστης δεν βρέθηκε' });
    }

    const isOk = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isOk) {
      return res.status(401).json({ success: false, message: 'Λάθος τρέχων κωδικός' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    return res.json({ success: true, message: 'Ο κωδικός άλλαξε επιτυχώς' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Route για κατηγορίες
app.get('/api/categories', async (req, res) => {
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

/**
 * GET /api/products (with filters + reviews)
 */
app.get('/api/products', async (req, res) => {
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

    // Search filter
    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Category filter
    if (category && category !== 'all') {
      query += ` AND c.name = ?`;
      params.push(category);
    }

    // Price filters
    if (minPrice) {
      query += ` AND p.price >= ?`;
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      query += ` AND p.price <= ?`;
      params.push(Number(maxPrice));
    }

    // GROUP BY (για τα aggregates)
    query += ` GROUP BY p.id, p.name, p.description, p.price, p.stock, p.image_url, p.category_id, p.created_at, c.name`;

    // Sorting
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

app.get('/api/products/:id', async (req, res) => {
  try {
    // Παίρνουμε το :id από το URL
    const productId = Number(req.params.id);

    // Validation: Είναι valid αριθμός;
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Μη έγκυρο ID προϊόντος'
      });
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

    // Αν δεν βρέθηκε το product
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Το προϊόν δεν βρέθηκε'
      });
    }

    res.json({ success: true, product: rows[0] });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ Orders: POST /api/orders (protected)
 * Δεν παίρνουμε userId από client. Τον παίρνουμε από token.
 */
app.post('/api/orders', authenticateToken, async (req, res) => {
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
    `SELECT * FROM discount_codes
     WHERE code = ? AND active = TRUE`,
    [code]
  );

  if (!rows.length) {
    await conn.rollback();
    return res.status(400).json({ success: false, message: 'Μη έγκυρος κωδικός έκπτωσης' });
  }

  const d = rows[0];
  discountCodeId = d.id;

  // Per-user check
  const [usage] = await conn.query(
    `SELECT id FROM discount_code_usages
     WHERE user_id = ? AND discount_code_id = ?`,
    [userId, discountCodeId]
  );

  if (usage.length > 0) {
    await conn.rollback();
    return res.status(400).json({
      success: false,
      message: 'Έχεις ήδη χρησιμοποιήσει αυτόν τον κωδικό έκπτωσης'
    });
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
    return res.status(400).json({
      success: false,
      message: `Ελάχιστο ποσό παραγγελίας: ${d.min_order_amount}€`
    });
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
         user_id,
         total_amount,
         status,
         recipient_name,
         phone,
         ship_country,
         ship_city,
         ship_zip,
         ship_address1,
         ship_notes,
         shipping_method,
         shipping_cost,
         payment_method,
         payment_status,
         subtotal,
         floor,
         discount_code,
         discount_amount
       )
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        computedTotal,
        recipientName.trim(),
        String(phone).trim(),

        ship.country || 'GR',
        ship.city,
        ship.zip,
        ship.address1,
        ship.notes || null,

        shippingMethod,
        shippingCost,

        paymentMethod,
        paymentStatus,

        subtotal,
        ship.floor || null,
        finalDiscountCode,
        discountAmount
      ]
    );

    const orderId = orderResult.insertId;

    for (const item of validatedItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, size)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.unitPrice, item.size || null]
      );

      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }

if (finalDiscountCode && discountCodeId) {
  await conn.query(
    `UPDATE discount_codes
     SET used_count = used_count + 1
     WHERE code = ?`,
    [finalDiscountCode]
  );

  await conn.query(
    `INSERT INTO discount_code_usages (user_id, discount_code_id, order_id)
     VALUES (?, ?, ?)`,
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
app.get('/api/my-orders', authenticateToken, async (req, res) => {
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

app.get('/api/my-orders/:orderId', authenticateToken, async (req, res) => {
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

app.post('/api/orders/:id/return', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = Number(req.params.id);
    const { reason, items } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Παρακαλώ συμπλήρωσε τον λόγο επιστροφής' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Επίλεξε τουλάχιστον ένα προϊόν για επιστροφή' });
    }

    const [rows] = await db.query(
      'SELECT status FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    if (rows[0].status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Μπορείτε να ζητήσετε επιστροφή μόνο για παραδομένες παραγγελίες' });
    }

    // Validate items against actual order items
    const [orderItems] = await db.query(
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

      if (!oi) return res.status(400).json({ success: false, message: `Προϊόν ${productId} δεν ανήκει σε αυτή την παραγγελία` });
      if (qty < 1 || qty > oi.quantity) return res.status(400).json({ success: false, message: `Μη έγκυρη ποσότητα για "${oi.product_name}"` });

      refundAmount += qty * Number(oi.unit_price);
      validatedItems.push({ productId, productName: oi.product_name, quantity: qty, unitPrice: Number(oi.unit_price) });
    }

    refundAmount = Number(refundAmount.toFixed(2));

    const [result] = await db.query(
      'INSERT INTO return_requests (order_id, user_id, reason, refund_amount) VALUES (?, ?, ?, ?)',
      [orderId, userId, String(reason).trim(), refundAmount]
    );

    const returnRequestId = result.insertId;

    for (const item of validatedItems) {
      await db.query(
        'INSERT INTO return_request_items (return_request_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
        [returnRequestId, item.productId, item.productName, item.quantity, item.unitPrice]
      );
    }

    return res.json({ success: true, message: 'Το αίτημα επιστροφής υποβλήθηκε επιτυχώς' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Έχετε ήδη υποβάλει αίτημα επιστροφής για αυτή την παραγγελία' });
    }
    console.error('Return request error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/admin/returns', authenticateToken, isAdmin, async (req, res) => {
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

app.patch('/api/admin/returns/:id', authenticateToken, isAdmin, async (req, res) => {
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
        await conn.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
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

app.patch('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
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
      return res.status(400).json({
        success: false,
        message: 'Μπορείτε να ακυρώσετε μόνο παραγγελίες σε αναμονή'
      });
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

// ========================================
// ADMIN ROUTES
// ========================================

/**
 * ✅ Admin: Get all products (with full details)
 */
app.get('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_url,
        p.category_id,
        p.created_at,
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

/**
 * ✅ Admin: Get single product
 */
app.get('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    
    const [rows] = await db.query(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error('Admin get product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ Admin: Create product
 */
app.post('/api/admin/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image_url, sizes } = req.body;

    if (!name || !price || stock == null) {
      return res.status(400).json({
        success: false,
        message: 'Το όνομα, η τιμή και το απόθεμα είναι υποχρεωτικά'
      });
    }

    const sizesJson = Array.isArray(sizes) && sizes.length > 0 ? JSON.stringify(sizes) : null;

    const [result] = await db.query(
      `INSERT INTO products (name, description, price, stock, category_id, image_url, sizes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, Number(price), Number(stock), category_id || null, image_url || null, sizesJson]
    );

    res.status(201).json({
      success: true,
      message: 'Το προϊόν δημιουργήθηκε επιτυχώς',
      productId: result.insertId
    });
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ Admin: Update product
 */
app.put('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { name, description, price, stock, category_id, image_url, sizes } = req.body;

    if (!name || !price || stock == null) {
      return res.status(400).json({
        success: false,
        message: 'Το όνομα, η τιμή και το απόθεμα είναι υποχρεωτικά'
      });
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

/**
 * ✅ Admin: Delete product
 */
app.delete('/api/admin/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = Number(req.params.id);

    // Check if product exists
    const [products] = await db.query('SELECT id, name FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    const productName = products[0].name;

    // Check if product is used in orders
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

    // Safe to delete
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Το προϊόν δεν βρέθηκε' });
    }

    return res.json({ 
      success: true, 
      message: `Το προϊόν "${productName}" διαγράφηκε επιτυχώς!` 
    });

  } catch (error) {
    console.error('Delete product error:', error);
    
    // Handle foreign key constraint error
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(400).json({ 
        success: false, 
        message: 'Δεν είναι δυνατή η διαγραφή γιατί το προϊόν χρησιμοποιείται ήδη σε υπάρχουσες παραγγελίες.' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: 'Αποτυχία διαγραφής προϊόντος. Παρακαλώ δοκιμάστε ξανά.' 
    });
  }
});
/**
 * ✅ Admin: Get all orders
 */
app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         o.id, 
         o.total_amount, 
         o.status, 
         o.created_at,
         o.recipient_name,
         o.phone,
         o.payment_status,
         u.email as user_email,
         u.first_name,
         u.last_name
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
/**
 * ✅ Admin: Get order details
 */
app.get('/api/admin/orders/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const [orders] = await db.query(
      `SELECT
         o.id,
         o.user_id,
         o.total_amount,
         o.status,
         o.created_at,
         o.subtotal,
         o.shipping_cost,
         o.shipping_method,
         o.payment_method,
         o.payment_status,
         o.recipient_name,
         o.phone,
         o.ship_country,
         o.ship_city,
         o.ship_zip,
         o.ship_address1,
         o.ship_notes,
         o.floor,
         o.discount_code,
         o.discount_amount,
         u.email,
         u.first_name,
         u.last_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Η παραγγελία δεν βρέθηκε'
      });
    }

    const order = orders[0];

    const [items] = await db.query(
      `SELECT
         oi.product_id,
         p.name AS product_name,
         oi.quantity,
         oi.unit_price,
         oi.size,
         (oi.quantity * oi.unit_price) AS line_total
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );

    res.json({
      success: true,
      order,
      items
    });

  } catch (error) {
    console.error('Admin order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * ✅ Admin: Update order status
 */
app.patch('/api/admin/orders/:id/status', authenticateToken, isAdmin, async (req, res) => {
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
      return res.status(400).json({
        success: false,
        message: `Δεν επιτρέπεται η αλλαγή κατάστασης από ${currentStatus} σε ${status}`
      });
    }

    if (status === 'delivered' && paymentMethod === 'cod') {
      await conn.query(
        `UPDATE orders SET status = ?, payment_status = 'paid' WHERE id = ?`,
        [status, orderId]
      );
    } else if (status === 'cancelled' && currentPaymentStatus === 'paid') {
      await conn.query(
        `UPDATE orders SET status = ?, payment_status = 'refunded' WHERE id = ?`,
        [status, orderId]
      );
    } else if (status === 'cancelled' && currentPaymentStatus === 'pending') {
      await conn.query(
        `UPDATE orders SET status = ?, payment_status = 'cancelled' WHERE id = ?`,
        [status, orderId]
      );
    } else {
      await conn.query(
        `UPDATE orders SET status = ? WHERE id = ?`,
        [status, orderId]
      );
    }

    if (status === 'cancelled') {
      const [orderItems] = await conn.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );
      for (const item of orderItems) {
        await conn.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
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
/**
 * ✅ Admin: Confirm payment for bank transfer orders
 */
app.patch('/api/admin/orders/:id/confirm-payment', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    const [rows] = await db.query(
      'SELECT payment_status FROM orders WHERE id = ?',
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Η παραγγελία δεν βρέθηκε' });
    }

    if (rows[0].payment_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Η πληρωμή δεν είναι σε εκκρεμότητα' });
    }

    await db.query(
      `UPDATE orders SET payment_status = 'paid' WHERE id = ?`,
      [orderId]
    );

    res.json({ success: true, message: 'Η πληρωμή επιβεβαιώθηκε' });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ Admin: Users list with order stats
 */
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent,
        MAX(o.created_at) AS last_order_at
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      GROUP BY u.id
      ORDER BY order_count DESC, u.created_at DESC
    `);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ✅ Admin: Dashboard stats
 */
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Total orders
    const [ordersCount] = await db.query('SELECT COUNT(*) as total FROM orders');
    
    // Total revenue
    const [revenue] = await db.query('SELECT SUM(total_amount) as total FROM orders WHERE status != "cancelled"');
    
    // Total users
    const [usersCount] = await db.query('SELECT COUNT(*) as total FROM users');
    
    // Total products
    const [productsCount] = await db.query('SELECT COUNT(*) as total FROM products');

    // Pending counts for badges
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

/**
 * GET /api/reviews/my
 * Protected - Μόνο οι κριτικές του logged-in χρήστη
 */
app.get('/api/reviews/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [reviews] = await db.query(`
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.product_id,
        r.user_id,
        p.name AS product_name,
        p.image_url AS product_image
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      reviews
    });

  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const productId = Number(req.params.productId);

    const [reviews] = await db.query(`
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
         r.user_id,
        u.first_name,
        u.last_name
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `, [productId]);

    // Υπολόγισε average rating
    const [avgResult] = await db.query(`
      SELECT 
        ROUND(AVG(rating), 1) as average,
        COUNT(*) as total
      FROM reviews
      WHERE product_id = ?
    `, [productId]);

    res.json({
      success: true,
      reviews,
      average: avgResult[0].average || 0,
      total: avgResult[0].total || 0
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/reviews/:productId
 * Protected - Μόνο logged-in users που έχουν αγοράσει
 */
app.post('/api/reviews/:productId', authenticateToken, async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const userId = req.user.id;
    const { rating, comment } = req.body;

    // Validation 1: Rating required
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Η βαθμολογία πρέπει να είναι μεταξύ 1 και 5'
      });
    }

    // Validation 2: Έχει αγοράσει το προϊόν;
    const [orders] = await db.query(`
      SELECT o.id 
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = ? 
        AND oi.product_id = ?
        AND o.status = 'delivered'
      LIMIT 1
    `, [userId, productId]);

    if (orders.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Μπορείτε να αξιολογήσετε μόνο προϊόντα που έχετε αγοράσει και παραλάβει.'
      });
    }

    // Validation 3: Έχει ήδη κάνει review;
    const [existing] = await db.query(
      'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?',
      [productId, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Έχετε ήδη αξιολογήσει αυτό το προϊόν.'
      });
    }

    // Insert review
    await db.query(
      'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      [productId, userId, rating, comment || null]
    );

    res.status(201).json({
      success: true,
      message: 'Η κριτική υποβλήθηκε με επιτυχία!'
    });

  } catch (error) {
    console.error('Post review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/reviews/:reviewId
 * Protected - Μόνο ο συγγραφέας ή admin
 */
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const userId = req.user.id;
    const userRole = req.user.role;

    // Βρες το review
    const [reviews] = await db.query(
      'SELECT * FROM reviews WHERE id = ?',
      [reviewId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Η κριτική δεν βρέθηκε'
      });
    }

    // Μόνο ο συγγραφέας ή admin μπορεί να διαγράψει
    if (reviews[0].user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Δεν έχετε δικαίωμα διαγραφής αυτής της κριτικής'
      });
    }

    await db.query('DELETE FROM reviews WHERE id = ?', [reviewId]);

    res.json({ success: true, message: 'Η κριτική διαγράφηκε επιτυχώς' });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
app.get('/api/admin/reviews', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.product_id,
        r.user_id,
        p.name AS product_name,
        p.image_url AS product_image,
        u.first_name,
        u.last_name,
        u.email
      FROM reviews r
      JOIN products p ON p.id = r.product_id
      JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
    `);

    res.json({ success: true, reviews });

  } catch (error) {
    console.error('Admin get all reviews error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
app.put('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const userId = req.user.id;
    const { rating, comment } = req.body;

    // Validation: Rating required
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Η βαθμολογία πρέπει να είναι μεταξύ 1 και 5'
      });
    }

    // Βρες το review
    const [reviews] = await db.query(
      'SELECT * FROM reviews WHERE id = ?',
      [reviewId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Η κριτική δεν βρέθηκε'
      });
    }

    // Μόνο ο συγγραφέας μπορεί να edit
    if (reviews[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Δεν έχετε δικαίωμα επεξεργασίας αυτής της κριτικής'
      });
    }

    // Update review
    await db.query(
      'UPDATE reviews SET rating = ?, comment = ? WHERE id = ?',
      [rating, comment || null, reviewId]
    );

    res.json({
      success: true,
      message: 'Η κριτική ενημερώθηκε επιτυχώς!'
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** Upload product image */

app.post('/api/upload-image', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Δεν επιλέχθηκε αρχείο' });
    }

    // File uploaded successfully
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      imageUrl: imageUrl,
      message: 'Η εικόνα ανέβηκε επιτυχώς'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Αποτυχία ανεβάσματος αρχείου' });
  }
});

/**
 * POST /api/validate-discount
 * Validate discount code and calculate discount
 */
app.post('/api/validate-discount', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, orderTotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Κωδικός απαιτείται' });
    }

    const [rows] = await db.query(
      `SELECT * FROM discount_codes
       WHERE code = ? AND active = TRUE`,
      [String(code).trim().toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Μη έγκυρος κωδικός έκπτωσης'
      });
    }

    const discount = rows[0];

    // ✅ Per-user check
    const [usageRows] = await db.query(
      `SELECT id FROM discount_code_usages
       WHERE user_id = ? AND discount_code_id = ?`,
      [userId, discount.id]
    );

    if (usageRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Έχεις ήδη χρησιμοποιήσει αυτόν τον κωδικό έκπτωσης'
      });
    }

    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Ο κωδικός έχει λήξει'
      });
    }

    if (discount.max_uses !== null && Number(discount.used_count) >= Number(discount.max_uses)) {
      return res.status(400).json({
        success: false,
        message: 'Ο κωδικός έχει εξαντληθεί'
      });
    }

    if (Number(orderTotal) < Number(discount.min_order_amount)) {
      return res.status(400).json({
        success: false,
        message: `Ελάχιστο ποσό παραγγελίας: ${discount.min_order_amount}€`
      });
    }

    let discountAmount = 0;

    if (discount.type === 'percentage') {
      discountAmount = (Number(orderTotal) * Number(discount.value)) / 100;
    } else if (discount.type === 'fixed') {
      discountAmount = Math.min(Number(discount.value), Number(orderTotal));
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      success: true,
      discount: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        amount: discountAmount
      }
    });

  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
/**
 * GET /api/admin/discount-codes
 * Get all discount codes (admin only)
 */
app.get('/api/admin/discount-codes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        id, code, type, value, 
        min_order_amount, max_uses, used_count,
        active, expires_at, created_at
      FROM discount_codes 
      ORDER BY created_at DESC`
    );

    res.json({ success: true, codes: rows });
  } catch (error) {
    console.error('Get discount codes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/admin/discount-codes
 * Create new discount code (admin only)
 */
app.post('/api/admin/discount-codes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { code, type, value, minOrderAmount, maxUses, expiresAt } = req.body;

    if (!code || !type || value == null) {
      return res.status(400).json({
        success: false,
        message: 'Κωδικός, τύπος και αξία είναι υποχρεωτικά'
      });
    }

    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Τύπος πρέπει να είναι percentage ή fixed'
      });
    }

    if (type === 'percentage' && (Number(value) < 0 || Number(value) > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Ποσοστό πρέπει να είναι 0-100'
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM discount_codes WHERE code = ?',
      [String(code).toUpperCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ο κωδικός υπάρχει ήδη'
      });
    }

    await db.query(
      `INSERT INTO discount_codes
       (code, type, value, min_order_amount, max_uses, expires_at, active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [
        String(code).toUpperCase(),
        type,
        Number(value),
        Number(minOrderAmount || 0),
        maxUses ? Number(maxUses) : null,
        expiresAt || null
      ]
    );

    res.json({ success: true, message: 'Κωδικός δημιουργήθηκε' });
  } catch (error) {
    console.error('Create discount code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/admin/discount-codes/:id
 * Update discount code (admin only)
 */
app.put('/api/admin/discount-codes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, minOrderAmount, maxUses, expiresAt, active } = req.body;

    if (!code || !type || value == null) {
      return res.status(400).json({
        success: false,
        message: 'Κωδικός, τύπος και αξία είναι υποχρεωτικά'
      });
    }

    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Τύπος πρέπει να είναι percentage ή fixed'
      });
    }

    if (type === 'percentage' && (Number(value) < 0 || Number(value) > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Ποσοστό πρέπει να είναι 0-100'
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM discount_codes WHERE code = ? AND id != ?',
      [String(code).toUpperCase(), id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ο κωδικός υπάρχει ήδη'
      });
    }

    const [result] = await db.query(
      `UPDATE discount_codes
       SET code = ?, type = ?, value = ?, min_order_amount = ?, max_uses = ?, expires_at = ?, active = ?
       WHERE id = ?`,
      [
        String(code).toUpperCase(),
        type,
        Number(value),
        Number(minOrderAmount || 0),
        maxUses ? Number(maxUses) : null,
        expiresAt || null,
        !!active,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ο κωδικός δεν βρέθηκε'
      });
    }

    res.json({ success: true, message: 'Ο κωδικός ενημερώθηκε' });
  } catch (error) {
    console.error('Update discount code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/admin/discount-codes/:id
 * Delete discount code (admin only)
 */
app.delete('/api/admin/discount-codes/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM discount_codes WHERE id = ?', [id]);

    res.json({ success: true, message: 'Κωδικός διαγράφηκε' });
  } catch (error) {
    console.error('Delete discount code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/admin/orders/:id/csv', authenticateToken, isAdmin, async (req, res) => {
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
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/orders/:id/pdf', authenticateToken, async (req, res) => {
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
    doc.registerFont('Roboto', path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'));
    doc.registerFont('RobotoBold', path.join(__dirname, 'fonts', 'Roboto-Bold.ttf'));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order-${order.id}.pdf`);
    doc.pipe(res);

    const paymentMethod = paymentMethodMap[order.payment_method] || order.payment_method;
    const shippingMethod = shippingMethodMap[order.shipping_method] || order.shipping_method;

    // Header
    doc.font('RobotoBold').fontSize(24).text('ECommerce', 50, 45);
    doc.font('Roboto').fontSize(10).text('support@ecommerce.com', 50, 70).text('www.ecommerce.com', 50, 85);
    doc.font('RobotoBold').fontSize(20).text('ΑΠΟΔΕΙΞΗ ΠΑΡΑΓΓΕΛΙΑΣ', 320, 50);
    doc.moveTo(50, 105).lineTo(550, 105).lineWidth(0.5).stroke();

    // Στοιχεία παραγγελίας (αριστερά)
    doc.font('RobotoBold').fontSize(11).text('ΣΤΟΙΧΕΙΑ ΠΑΡΑΓΓΕΛΙΑΣ', 50, 120);
    doc.font('Roboto').fontSize(10)
      .text(`Αριθμός: ${order.id}`, 50, 136)
      .text(`Ημερομηνία: ${new Date(order.created_at).toLocaleDateString('el-GR')}`, 50, 151)
      .text(`Email: ${order.email}`, 50, 166, { width: 230, lineBreak: false })
      .text(`Τρόπος Πληρωμής: ${paymentMethod}`, 50, 181, { width: 230, lineBreak: false })
      .text(`Τρόπος Αποστολής: ${shippingMethod}`, 50, 196, { width: 230, lineBreak: false });

    // Διεύθυνση αποστολής (δεξιά)
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

    // Table header
    const cols = { product: 60, qty: 330, price: 410, total: 490 };

    doc.rect(50, tableY - 5, 500, 20).fill('#f2f2f2').fillColor('black');
    doc.font('RobotoBold')
      .text('Προϊόν', cols.product, tableY)
      .text('Ποσότητα', cols.qty, tableY, { width: 60, align: 'right' })
      .text('Τιμή', cols.price, tableY, { width: 60, align: 'right' })
      .text('Σύνολο', cols.total, tableY, { width: 60, align: 'right' });

    tableY += 25;
    doc.moveTo(50, tableY - 5).lineTo(550, tableY - 5).stroke();

    // Προϊόντα
    doc.font('Roboto').fontSize(12);
    items.forEach(({ title, quantity, price }) => {
      doc.text(title, cols.product, tableY)
        .text(quantity.toString(), cols.qty, tableY, { width: 60, align: 'right' })
        .text(`€${Number(price).toFixed(2)}`, cols.price, tableY, { width: 60, align: 'right' })
        .text(`€${(quantity * price).toFixed(2)}`, cols.total, tableY, { width: 60, align: 'right' });
      tableY += 28;
    });

    // Summary
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

    // Footer
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
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});