const express = require('express');
const { Pool } = require('pg');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = 3000;

// Servir frontend
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin123',
  database: process.env.DB_NAME || 'postgres',
  port: 5432
});

// Servidor HTTP
const server = app.listen(port, () => {
  console.log(`Dashboard corriendo en http://localhost:${port}`);
});

// Servidor WebSocket
const wss = new WebSocket.Server({ server });
const clients = new Set();

// Enviar todos los mensajes guardados al cliente que se conecta
async function sendHistory(ws) {
  const res = await pool.query('SELECT content, created_at FROM messages ORDER BY created_at DESC LIMIT 50');
  res.rows.reverse().forEach(row => ws.send(`[${row.created_at.toLocaleString()}] ${row.content}`));
}

wss.on('connection', ws => {
  clients.add(ws);
  console.log('Cliente conectado, total:', clients.size);

  sendHistory(ws);

  ws.on('message', async message => {
    // Guardar en DB
    await pool.query('INSERT INTO messages(content) VALUES($1)', [message]);

    // Enviar a todos los clientes conectados
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`[${new Date().toLocaleTimeString()}] ${message}`);
      }
    });
  });

  ws.on('close', () => clients.delete(ws));
});
