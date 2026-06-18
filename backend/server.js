const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));

// Serve uploaded images
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/products'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/reviews'));
app.use('/api', require('./routes/discounts'));
app.use('/api', require('./routes/admin/products'));
app.use('/api', require('./routes/admin/orders'));
app.use('/api', require('./routes/admin/users'));
app.use('/api', require('./routes/admin/stats'));
app.use('/api', require('./routes/admin/reviews'));
app.use('/api', require('./routes/admin/discounts'));
app.use('/api', require('./routes/admin/returns'));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
