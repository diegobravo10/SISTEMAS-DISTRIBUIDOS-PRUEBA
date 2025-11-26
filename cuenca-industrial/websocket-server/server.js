const WebSocket = require('ws');
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

// Configuración
const WS_PORT = 9000;
const HTTP_PORT = 3000;

// ✅ PostgreSQL Pool con configuración correcta
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',  // ← Cambiado de 'localhost'
  database: process.env.POSTGRES_DB || 'alertas_db',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin123',
  port: 5432,
});

// Servidor WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

console.log('='.repeat(60));
console.log('🌐 SERVIDOR WEBSOCKET - CUENCA INDUSTRIAL');
console.log('='.repeat(60));
console.log(`✓ WebSocket Server escuchando en ws://localhost:${WS_PORT}`);

// Almacenar clientes conectados
let clients = new Set();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`\n✓ Nuevo cliente conectado: ${clientIp}`);
  console.log(`👥 Clientes activos: ${clients.size + 1}`);
  
  clients.add(ws);
  
  // Enviar mensaje de bienvenida
  ws.send(JSON.stringify({
    tipo: 'sistema',
    mensaje: 'Conectado al Centro de Control de Seguridad Industrial',
    timestamp: new Date().toISOString()
  }));
  
  // Manejo de mensajes entrantes (del procesador)
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Reenviar a todos los clientes conectados (broadcast)
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
      
      const emoji = data.nivel === 'critico' ? '🔴' : 
                    data.nivel === 'advertencia' ? '🟡' : '🟢';
      console.log(`${emoji} Alerta transmitida a ${clients.size} clientes: ${data.mensaje}`);
      
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  });
  
  // Manejo de desconexión
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`\n✗ Cliente desconectado: ${clientIp}`);
    console.log(`👥 Clientes activos: ${clients.size}`);
  });
  
  // Manejo de errores
  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
    clients.delete(ws);
  });
});

// Servidor HTTP para el cliente web
const app = express();
app.use(express.json()); // ✅ AÑADIDO: Necesario para recibir POST del procesador

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ✅ NUEVO: Endpoint para que el procesador envíe alertas
app.post('/api/alerta', (req, res) => {
  try {
    const alerta = req.body;
    
    // Broadcast a todos los clientes WebSocket
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(alerta));
      }
    });
    
    const emoji = alerta.nivel === 'critico' ? '🔴' : 
                  alerta.nivel === 'advertencia' ? '🟡' : '🟢';
    console.log(`${emoji} Alerta transmitida a ${clients.size} clientes: ${alerta.mensaje}`);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error procesando alerta:', error);
    res.status(500).json({ error: 'Error procesando alerta' });
  }
});

// ✅ API para obtener histórico de alertas (CORREGIDO)
app.get('/api/alertas', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      'SELECT * FROM alertas ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    // ✅ Siempre devolver array
    res.json(Array.isArray(result.rows) ? result.rows : []);
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json([]); // ✅ Devolver array vacío en error
  }
});

// API para estadísticas de sensores
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sensor_id,
        ultima_lectura,
        total_alertas,
        alertas_criticas,
        alertas_advertencia,
        alertas_normales
      FROM sensores_stats
      ORDER BY ultima_lectura DESC
    `);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json([]);
  }
});

// ✅ API para estadísticas generales (CORREGIDO)
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_alertas,
        SUM(CASE WHEN nivel = 'critico' THEN 1 ELSE 0 END) as criticas,
        SUM(CASE WHEN nivel = 'advertencia' THEN 1 ELSE 0 END) as advertencias,
        SUM(CASE WHEN nivel = 'normal' THEN 1 ELSE 0 END) as normales
      FROM alertas
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);
    
    const sensoresActivos = await pool.query(`
      SELECT COUNT(*) as total
      FROM sensores_stats
      WHERE ultima_lectura > NOW() - INTERVAL '5 minutes'
    `);
    
    res.json({
      total_alertas: parseInt(stats.rows[0]?.total_alertas || 0),
      criticas: parseInt(stats.rows[0]?.criticas || 0),
      advertencias: parseInt(stats.rows[0]?.advertencias || 0),
      normales: parseInt(stats.rows[0]?.normales || 0),
      sensores_activos: parseInt(sensoresActivos.rows[0]?.total || 0)
    });
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      total_alertas: 0,
      criticas: 0,
      advertencias: 0,
      normales: 0,
      sensores_activos: 0
    });
  }
});

// ✅ Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    clients: clients.size,
    timestamp: new Date().toISOString()
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`✓ HTTP Server escuchando en http://localhost:${HTTP_PORT}`);
  console.log('\n📊 Panel de control disponible en el navegador');
  console.log('='.repeat(60) + '\n');
  
  // ✅ Probar conexión a PostgreSQL
  pool.query('SELECT NOW()', (err, result) => {
    if (err) {
      console.error('❌ Error conectando a PostgreSQL:', err.message);
    } else {
      console.log('✅ Conectado a PostgreSQL correctamente');
    }
  });
});