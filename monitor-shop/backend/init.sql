-- Crear tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de compras (historial)
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar productos de ejemplo
INSERT INTO products (name, price, icon, stock) VALUES
('Laptop', 899.99, '💻', 50),
('Smartphone', 599.99, '📱', 100),
('Auriculares', 79.99, '🎧', 150),
('Tablet', 399.99, '📱', 75),
('Smartwatch', 249.99, '⌚', 80),
('Cámara', 699.99, '📷', 40),
('Teclado', 89.99, '⌨️', 120),
('Mouse', 49.99, '🖱️', 200),
('Monitor', 299.99, '🖥️', 60),
('Parlantes', 149.99, '🔊', 90),
('Micrófono', 129.99, '🎤', 70),
('Webcam', 99.99, '📹', 85);

-- Insertar un usuario de ejemplo
INSERT INTO users (username) VALUES ('usuario_demo');