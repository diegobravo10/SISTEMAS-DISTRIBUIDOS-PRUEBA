const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuración de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'shopuser',
  password: process.env.DB_PASSWORD || 'shoppass',
  database: process.env.DB_NAME || 'shopdb',
  port: process.env.DB_PORT || 5432,
});

// Almacenar conexiones de clientes
const clients = new Map();

// Probar conexión a la base de datos
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error conectando a PostgreSQL:', err);
  } else {
    console.log('✅ Conectado a PostgreSQL:', res.rows[0].now);
  }
});

// WebSocket - Manejo de conexiones
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`🔌 Cliente conectado: ${clientId} (Total: ${clients.size})`);
  
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId,
    message: 'Conectado al servidor de compras'
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Mensaje recibido:', data);

      switch (data.type) {
        case 'get_products':
          await handleGetProducts(ws);
          break;
        case 'purchase':
          await handlePurchase(ws, data, clientId);
          break;
        case 'get_history':
          await handleGetHistory(ws, data);
          break;
        case 'register_user':
          await handleRegisterUser(ws, data);
          break;
        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Tipo de mensaje desconocido' }));
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`🔌 Cliente desconectado: ${clientId} (Total: ${clients.size})`);
  });

  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
  });
});

// Handler: Obtener productos
async function handleGetProducts(ws) {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    ws.send(JSON.stringify({
      type: 'products',
      data: result.rows
    }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Error obteniendo productos' }));
  }
}

// Handler: Realizar compra
async function handlePurchase(ws, data, clientId) {
  const { userId, productId, quantity } = data;

  try {
    // Verificar stock
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: 'Producto no encontrado' }));
      return;
    }

    const product = productResult.rows[0];
    if (product.stock < quantity) {
      ws.send(JSON.stringify({ type: 'error', message: 'Stock insuficiente' }));
      return;
    }

    const totalPrice = product.price * quantity;

    // Registrar compra
    await pool.query(
      'INSERT INTO purchases (user_id, product_id, quantity, total_price) VALUES ($1, $2, $3, $4)',
      [userId, productId, quantity, totalPrice]
    );

    // Actualizar stock
    await pool.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [quantity, productId]
    );

    // Notificar al cliente que compró
    ws.send(JSON.stringify({
      type: 'purchase_success',
      message: 'Compra realizada exitosamente',
      data: {
        product: product.name,
        quantity: quantity,
        total: totalPrice
      }
    }));

    // Notificar a todos los clientes sobre el cambio de stock
    broadcastStockUpdate(productId);

  } catch (error) {
    console.error('Error en compra:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Error procesando compra' }));
  }
}

// Handler: Obtener historial de compras
async function handleGetHistory(ws, data) {
  const { userId } = data;

  try {
    const result = await pool.query(
      `SELECT p.id, pr.name, pr.icon, p.quantity, p.total_price, p.purchase_date
       FROM purchases p
       JOIN products pr ON p.product_id = pr.id
       WHERE p.user_id = $1
       ORDER BY p.purchase_date DESC`,
      [userId]
    );

    ws.send(JSON.stringify({
      type: 'history',
      data: result.rows
    }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Error obteniendo historial' }));
  }
}

// Handler: Registrar usuario
async function handleRegisterUser(ws, data) {
  const { username } = data;

  try {
    const result = await pool.query(
      'INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET username = $1 RETURNING id, username',
      [username]
    );

    ws.send(JSON.stringify({
      type: 'user_registered',
      data: result.rows[0]
    }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Error registrando usuario' }));
  }
}

// Broadcast: Actualización de stock a todos los clientes
async function broadcastStockUpdate(productId) {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (result.rows.length > 0) {
      const message = JSON.stringify({
        type: 'stock_update',
        data: result.rows[0]
      });

      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  } catch (error) {
    console.error('Error broadcasting stock update:', error);
  }
}

// REST API endpoints (opcionales, para consultas HTTP)
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
});