CREATE DATABASE IF NOT EXISTS ecommerce;
USE ecommerce;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  category_id INT,
  sizes JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  recipient_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  ship_country VARCHAR(100) DEFAULT 'GR',
  ship_city VARCHAR(100) NOT NULL,
  ship_zip VARCHAR(20) NOT NULL,
  ship_address1 VARCHAR(255) NOT NULL,
  ship_notes TEXT,
  floor VARCHAR(50),
  shipping_method ENUM('courier_standard', 'courier_express', 'pickup') NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cod', 'card_mock', 'bank_transfer') NOT NULL,
  payment_status ENUM('pending', 'paid', 'refunded', 'cancelled') DEFAULT 'pending',
  discount_code VARCHAR(100),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  size VARCHAR(20) NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_review (product_id, user_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE discount_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  type ENUM('percentage', 'fixed') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_uses INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discount_code_usages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  discount_code_id INT NOT NULL,
  order_id INT NOT NULL,
  UNIQUE KEY unique_usage (user_id, discount_code_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE return_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL UNIQUE,
  user_id INT NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_note TEXT,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE return_request_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  return_request_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (return_request_id) REFERENCES return_requests(id) ON DELETE CASCADE
);

-- Sample categories
INSERT INTO categories (name) VALUES ('Ηλεκτρονικά'), ('Ρούχα'), ('Βιβλία'), ('Αθλητικά');

-- To create an admin: register normally, then run:
-- UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
