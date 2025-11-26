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

// Configuración del simulador
let simulatorInterval = null;
let isSimulatorRunning = false;

// Nombres de usuarios simulados
const virtualUsers = [
  'María García', 'Juan Pérez', 'Ana Martínez', 'Carlos López',
  'Laura Rodríguez', 'Pedro Sánchez', 'Sofia Torres', 'Miguel Flores',
  'Elena Ramírez', 'Diego Castro', 'Carmen Ruiz', 'Roberto Morales',
  'Patricia Ortiz', 'Fernando Díaz', 'Isabel Vargas'
];

// Probar conexión a la base de datos
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error conectando a PostgreSQL:', err);
  } else {
    console.log('✅ Conectado a PostgreSQL:', res.rows[0].now);
    initializeVirtualUsers();
  }
});

// Inicializar usuarios virtuales en la BD
async function initializeVirtualUsers() {
  try {
    for (const username of virtualUsers) {
      await pool.query(
        'INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING',
        [username]
      );
    }
    console.log('✅ Usuarios virtuales inicializados');
  } catch (error) {
    console.error('Error inicializando usuarios:', error);
  }
}

// WebSocket - Manejo de conexiones
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`🔌 Cliente conectado: ${clientId} (Total: ${clients.size})`);
  
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId,
    message: 'Conectado al servidor de monitoreo'
  }));

  // Enviar estado actual del simulador
  ws.send(JSON.stringify({
    type: 'simulator_status',
    isRunning: isSimulatorRunning
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Mensaje recibido:', data);

      switch (data.type) {
        case 'get_products':
          await handleGetProducts(ws);
          break;
        case 'get_history':
          await handleGetHistory(ws);
          break;
        case 'get_stats':
          await handleGetStats(ws);
          break;
        case 'start_simulator':
          startSimulator();
          break;
        case 'stop_simulator':
          stopSimulator();
          break;
        case 'clear_history':
          await clearHistory(ws);
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

// Handler: Obtener historial completo
async function handleGetHistory(ws) {
  try {
    const result = await pool.query(
      `SELECT p.id, u.username, pr.name, pr.icon, p.quantity, p.total_price, p.purchase_date
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       JOIN products pr ON p.product_id = pr.id
       ORDER BY p.purchase_date DESC
       LIMIT 100`
    );

    ws.send(JSON.stringify({
      type: 'history',
      data: result.rows
    }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Error obteniendo historial' }));
  }
}

// Handler: Obtener estadísticas
async function handleGetStats(ws) {
  try {
    // Total de compras
    const totalPurchases = await pool.query('SELECT COUNT(*) as total FROM purchases');
    
    // Total de ingresos
    const totalRevenue = await pool.query('SELECT SUM(total_price) as total FROM purchases');
    
    // Usuario con más compras
    const topBuyer = await pool.query(
      `SELECT u.username, COUNT(p.id) as purchases, SUM(p.total_price) as total_spent
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       GROUP BY u.username
       ORDER BY purchases DESC
       LIMIT 1`
    );
    
    // Producto más vendido
    const topProduct = await pool.query(
      `SELECT pr.name, pr.icon, COUNT(p.id) as times_sold, SUM(p.quantity) as total_quantity
       FROM purchases p
       JOIN products pr ON p.product_id = pr.id
       GROUP BY pr.name, pr.icon
       ORDER BY times_sold DESC
       LIMIT 1`
    );

    ws.send(JSON.stringify({
      type: 'stats',
      data: {
        totalPurchases: parseInt(totalPurchases.rows[0].total) || 0,
        totalRevenue: parseFloat(totalRevenue.rows[0].total) || 0,
        topBuyer: topBuyer.rows[0] || null,
        topProduct: topProduct.rows[0] || null
      }
    }));
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Error obteniendo estadísticas' }));
  }
}

// Limpiar historial
async function clearHistory(ws) {
  try {
    await pool.query('DELETE FROM purchases');
    await pool.query('UPDATE products SET stock = 100');
    
    broadcast({
      type: 'history_cleared',
      message: 'Historial limpiado'
    });
    
    // Recargar productos y estadísticas
    const productsResult = await pool.query('SELECT * FROM products ORDER BY id');
    broadcast({
      type: 'products',
      data: productsResult.rows
    });
    
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Error limpiando historial' }));
  }
}

// SIMULADOR DE COMPRAS ALEATORIAS
function startSimulator() {
  if (isSimulatorRunning) {
    console.log('⚠️ Simulador ya está corriendo');
    return;
  }

  isSimulatorRunning = true;
  console.log('🤖 Simulador de compras iniciado');

  broadcast({
    type: 'simulator_status',
    isRunning: true,
    message: 'Simulador iniciado'
  });

  // Generar compra cada 2-5 segundos
  const simulatePurchase = async () => {
    try {
      // Obtener productos disponibles
      const productsResult = await pool.query('SELECT * FROM products WHERE stock > 0');
      if (productsResult.rows.length === 0) {
        console.log('⚠️ No hay productos con stock');
        return;
      }

      // Seleccionar producto aleatorio
      const product = productsResult.rows[Math.floor(Math.random() * productsResult.rows.length)];
      
      // Seleccionar cantidad aleatoria (1-5)
      const maxQuantity = Math.min(product.stock, 5);
      const quantity = Math.floor(Math.random() * maxQuantity) + 1;

      // Seleccionar usuario aleatorio
      const usersResult = await pool.query('SELECT * FROM users');
      const user = usersResult.rows[Math.floor(Math.random() * usersResult.rows.length)];

      // Realizar compra
      const totalPrice = product.price * quantity;

      await pool.query(
        'INSERT INTO purchases (user_id, product_id, quantity, total_price) VALUES ($1, $2, $3, $4)',
        [user.id, product.id, quantity, totalPrice]
      );

      await pool.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [quantity, product.id]
      );

      console.log(`🛒 Compra simulada: ${user.username} compró ${quantity}x ${product.name}`);

      // Obtener producto actualizado
      const updatedProduct = await pool.query('SELECT * FROM products WHERE id = $1', [product.id]);

      // Broadcast a todos los clientes
      broadcast({
        type: 'purchase_notification',
        data: {
          username: user.username,
          product: product.name,
          icon: product.icon,
          quantity: quantity,
          total: totalPrice,
          timestamp: new Date()
        }
      });

      broadcast({
        type: 'stock_update',
        data: updatedProduct.rows[0]
      });

      // Actualizar historial y estadísticas
      await broadcastHistory();
      await broadcastStats();

    } catch (error) {
      console.error('Error en compra simulada:', error);
    }
  };

  // Ejecutar simulación con intervalos aleatorios
  const scheduleNext = () => {
    if (!isSimulatorRunning) return;
    
    const delay = Math.random() * 3000 + 2000; // 2-5 segundos
    simulatorInterval = setTimeout(() => {
      simulatePurchase();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}

function stopSimulator() {
  if (!isSimulatorRunning) {
    console.log('⚠️ Simulador ya está detenido');
    return;
  }

  isSimulatorRunning = false;
  if (simulatorInterval) {
    clearTimeout(simulatorInterval);
    simulatorInterval = null;
  }

  console.log('🛑 Simulador de compras detenido');

  broadcast({
    type: 'simulator_status',
    isRunning: false,
    message: 'Simulador detenido'
  });
}

// Broadcast: Enviar historial a todos
async function broadcastHistory() {
  try {
    const result = await pool.query(
      `SELECT p.id, u.username, pr.name, pr.icon, p.quantity, p.total_price, p.purchase_date
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       JOIN products pr ON p.product_id = pr.id
       ORDER BY p.purchase_date DESC
       LIMIT 100`
    );

    broadcast({
      type: 'history',
      data: result.rows
    });
  } catch (error) {
    console.error('Error broadcasting history:', error);
  }
}

// Broadcast: Enviar estadísticas a todos
async function broadcastStats() {
  try {
    const totalPurchases = await pool.query('SELECT COUNT(*) as total FROM purchases');
    const totalRevenue = await pool.query('SELECT SUM(total_price) as total FROM purchases');
    
    const topBuyer = await pool.query(
      `SELECT u.username, COUNT(p.id) as purchases, SUM(p.total_price) as total_spent
       FROM purchases p
       JOIN users u ON p.user_id = u.id
       GROUP BY u.username
       ORDER BY purchases DESC
       LIMIT 1`
    );
    
    const topProduct = await pool.query(
      `SELECT pr.name, pr.icon, COUNT(p.id) as times_sold, SUM(p.quantity) as total_quantity
       FROM purchases p
       JOIN products pr ON p.product_id = pr.id
       GROUP BY pr.name, pr.icon
       ORDER BY times_sold DESC
       LIMIT 1`
    );

    broadcast({
      type: 'stats',
      data: {
        totalPurchases: parseInt(totalPurchases.rows[0].total) || 0,
        totalRevenue: parseFloat(totalRevenue.rows[0].total) || 0,
        topBuyer: topBuyer.rows[0] || null,
        topProduct: topProduct.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Error broadcasting stats:', error);
  }
}

// Función para enviar mensaje a todos los clientes
function broadcast(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// REST API endpoints
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    simulatorRunning: isSimulatorRunning
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
});