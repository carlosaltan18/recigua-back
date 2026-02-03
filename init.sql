-- =========================================
-- RECIGUA Database
-- =========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- Roles table
-- =========================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- Users table
-- =========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- User Roles
-- =========================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

-- =========================================
-- Suppliers table
-- =========================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  representative VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- Products table
-- =========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  price_per_quintal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- Reports table
-- =========================================

CREATE TYPE report_state AS ENUM (
  'PENDING',
  'APPROVED',
  'CANCELLED'
);

CREATE TYPE weight_unit_enum AS ENUM (
  'quintals',
  'pounds',
  'kilograms',
  'tons'
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  user_id UUID NOT NULL REFERENCES users(id),
  gross_weight DECIMAL(10,2) NOT NULL,   -- peso bruto
  tare_weight DECIMAL(10,2) NOT NULL,    -- peso tara
  net_weight DECIMAL(10,2) NOT NULL,     -- calculado: bruto - tara
  extra_percentage DECIMAL(5,2) NOT NULL,
  base_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  driver_name VARCHAR(200) NOT NULL,
  state report_state NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),

  weight DECIMAL(10,2) NOT NULL,
  weight_unit weight_unit_enum NOT NULL,
  weight_in_quintals DECIMAL(10,4) NOT NULL,

  price_per_quintal DECIMAL(10,2) NOT NULL,
  base_price DECIMAL(12,2) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- System configuration table
-- =========================================
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extra_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================
-- Indexes
-- =========================================
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_supplier ON reports(supplier_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =========================================
-- Insert default roles
-- =========================================
INSERT INTO roles (name, description) VALUES
  ('ROLE_ADMIN', 'Administrator with full access'),
  ('ROLE_USER', 'User with limited access')
ON CONFLICT (name) DO NOTHING;

-- =========================================
-- system configuration
-- =========================================
INSERT INTO system_config (extra_percentage)
SELECT 5.00
WHERE NOT EXISTS (SELECT 1 FROM system_config);

-- =========================================
-- default admin user
-- password: admin123 
-- =========================================
INSERT INTO users (first_name, last_name, email, password) VALUES
  (
    'Admin',
    'System',
    'admin@recigua.com',
    'admin123'
  )
ON CONFLICT (email) DO NOTHING;

-- =========================================
-- Assign ROLE_ADMIN
-- =========================================
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'ROLE_ADMIN'
WHERE u.email = 'admin@recigua.com'
ON CONFLICT DO NOTHING;
