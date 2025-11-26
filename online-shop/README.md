# 🛒 Proyecto 1: Online Shop (Sistema Interactivo)

Sistema donde múltiples usuarios pueden comprar productos y ver actualizaciones en tiempo real.

📁 Estructura
```
online-shop/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── init.sql
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── public/
        └── index.html
```
        
# 🚀 Comandos de Ejecución

Iniciar el proyecto

bashcd online-shop
```
docker-compose up --build
```
Detener el proyecto
```
bashdocker-compose down
```
Detener y eliminar todo (incluye base de datos)
```
bashdocker-compose down -v
```
Ver logs bash
```
# Ver todos los logs
docker-compose logs

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker logs shop_backend
docker logs shop_frontend
docker logs shop_postgres
```
# 🌐 Acceso a la Aplicación

*  Frontend (Tienda): http://localhost:3000

*  Backend API: http://localhost:3001

*  API Health Check: http://localhost:3001/api/health

*  API Productos: http://localhost:3001/api/products

*  PostgreSQL: localhost:5432

#🗄️ Acceso a la Base de Datos

Conectarse vía terminal (psql)
```
bashdocker exec -it shop_postgres psql -U shopuser -d shopdb
```
Comandos dentro de PostgreSQL
```
sql-- Ver todas las tablas

\dt
-- Ver estructura de tablas

\d products

\d users

\d purchases
```

-- Ver todos los productos

```
SELECT * FROM products;
```

-- Ver historial de compras
```
SELECT 
    u.username,
    pr.name as producto,
    pr.icon,
    p.quantity,
    p.total_price,
    p.purchase_date
FROM purchases p
JOIN users u ON p.user_id = u.id
JOIN products pr ON p.product_id = pr.id
ORDER BY p.purchase_date DESC
LIMIT 20;

-- Ver stock de productos
SELECT name, icon, stock FROM products ORDER BY stock ASC;

-- Estadísticas: Total de compras
SELECT COUNT(*) as total_compras FROM purchases;

-- Estadísticas: Total de ingresos
SELECT SUM(total_price) as ingresos FROM purchases;

-- Usuario con más compras
SELECT 
    u.username,
    COUNT(p.id) as compras,
    SUM(p.total_price) as total
FROM purchases p
JOIN users u ON p.user_id = u.id
GROUP BY u.username
ORDER BY compras DESC;

-- Salir de psql
\q
```
Ejecutar consultas SQL directas (sin entrar a psql)

bash# Ver total de compras
```
docker exec -it shop_postgres psql -U shopuser -d shopdb -c "SELECT COUNT(*) FROM purchases;"
```

# Ver productos con poco stock
```
docker exec -it shop_postgres psql -U shopuser -d shopdb -c "SELECT name, stock FROM products WHERE stock < 20;"
```
