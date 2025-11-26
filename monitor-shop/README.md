# 📊 Proyecto 2: Monitor Shop (Dashboard con Simulador)

Dashboard de monitoreo en tiempo real con simulador automático de compras.

## 📁 Estructura
```
monitor-shop/
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
bashcd monitor-shop
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
Ver logs
```
bash# Ver todos los logs
docker-compose logs

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de servicios específicos
docker logs monitor_backend
docker logs monitor_frontend
docker logs monitor_postgres
Reiniciar un servicio específico
bashdocker restart monitor_backend
docker restart monitor_frontend
docker restart monitor_postgres


```
#🌐 Acceso a la Aplicación

*  Frontend (Dashboard): http://localhost:3100

*  Backend API: http://localhost:3002

*  API Health Check: http://localhost:3002/api/health

*  API Productos: http://localhost:3002/api/products

*  PostgreSQL: localhost:5433

*  pgAdmin: http://localhost:5050

#🗄️ Acceso a la Base de Datos

Conectarse vía terminal (psql)
```
bashdocker exec -it monitor_postgres psql -U shopuser -d shopdb
```
Comandos dentro de PostgreSQL
```
sql-- Ver todas las tablas
\dt

-- Ver estructura de tablas
\d products
\d users
\d purchases

-- Ver todos los productos con stock
SELECT * FROM products;

-- Ver últimas 50 compras
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
LIMIT 50;

-- Ver productos con stock bajo
SELECT name, icon, stock 
FROM products 
WHERE stock < 20 
ORDER BY stock ASC;

-- Estadísticas completas
SELECT 
    COUNT(p.id) as total_compras,
    SUM(p.total_price) as ingresos_totales,
    AVG(p.total_price) as promedio_compra,
    MAX(p.total_price) as compra_maxima
FROM purchases p;

-- Top 5 compradores
SELECT 
    u.username,
    COUNT(p.id) as compras,
    SUM(p.total_price) as total_gastado
FROM purchases p
JOIN users u ON p.user_id = u.id
GROUP BY u.username
ORDER BY compras DESC
LIMIT 5;

-- Top 5 productos más vendidos
SELECT 
    pr.name,
    pr.icon,
    COUNT(p.id) as veces_vendido,
    SUM(p.quantity) as unidades_totales
FROM purchases p
JOIN products pr ON p.product_id = pr.id
GROUP BY pr.name, pr.icon
ORDER BY veces_vendido DESC
LIMIT 5;

-- Limpiar historial y resetear stock
DELETE FROM purchases;
UPDATE products SET stock = 100;

-- Salir
\q

```
Ejecutar consultas SQL directas
bash# Ver total de compras
```
docker exec -it monitor_postgres psql -U shopuser -d shopdb -c "SELECT COUNT(*) FROM purchases;"
```
# Ver ingresos totales
```
docker exec -it monitor_postgres psql -U shopuser -d shopdb -c "SELECT SUM(total_price) FROM purchases;"
```
# Ver usuarios virtuales
```
docker exec -it monitor_postgres psql -U shopuser -d shopdb -c "SELECT * FROM users;"
```
Backup y Restore
bash# Crear backup
```
docker exec -it monitor_postgres pg_dump -U shopuser shopdb > backup_monitor.sql
```
# Restaurar backup
```
docker exec -i monitor_postgres psql -U shopuser shopdb < backup_monitor.sql
```
pgAdmin (Interfaz Gráfica)
bash# Acceder a pgAdmin
```
http://localhost:5050

# Credenciales:
Email: admin@shop.com
Password: admin

# Configuración de conexión:
Host: postgres
Port: 5432
Database: shopdb
Username: shopuser
Password: shoppass
```
📝 Cómo Usar

Accede a http://localhost:3100

Verás el dashboard con estadísticas

Haz clic en "▶️ Iniciar" para comenzar la simulación

Observa cómo aparecen compras automáticas cada 2-5 segundos

Ve las actualizaciones en tiempo real:

*  Stock de productos

*  Historial de compras

*  Estadísticas generales

*  Actividad reciente


Haz clic en "⏸️ Detener" para pausar la simulación

Usa "🗑️ Limpiar" para resetear todo

Abre múltiples pestañas para ver la sincronización


🔧 Comandos Docker Útiles
Ver contenedores activos
```
bashdocker ps
```
Ver todos los contenedores (incluidos detenidos)
```
bashdocker ps -a
```
Detener un contenedor específico
```
bashdocker stop shop_backend

docker stop monitor_frontend
```
Eliminar un contenedor específico
```
bashdocker rm shop_backend
docker rm -f monitor_postgres  # -f fuerza la eliminación

```
Ver logs de un contenedor
```
bashdocker logs shop_backend
docker logs -f monitor_backend  # -f para seguir logs en tiempo real
docker logs --tail 50 shop_postgres  # ver últimas 50 líneas
```
Entrar al contenedor (shell)
```
bashdocker exec -it shop_backend sh
docker exec -it monitor_postgres bash
```
Limpiar todo Docker (CUIDADO)
bash# Detener todos los contenedores
```
docker stop $(docker ps -aq)

# Eliminar todos los contenedores
docker rm $(docker ps -aq)

# Eliminar imágenes sin usar
docker image prune -a

# Limpiar volúmenes (borra bases de datos)
docker volume prune
```

🐛 Solución de Problemas
Error: "port is already allocated"
bash# Ver qué está usando el puerto
```
netstat -ano | findstr :3000

# Cambiar el puerto en docker-compose.yml
ports:
  - "3100:3000"  # nuevo_puerto:puerto_interno
Error: "container name already in use"
bash# Eliminar el contenedor conflictivo
docker rm -f nombre_contenedor

# O eliminar todos
docker rm -f $(docker ps -aq)
WebSocket no conecta
bash# Verificar que el backend esté corriendo
docker logs shop_backend
```

# Verificar la URL en el código HTML
# Debe coincidir con el puerto del backend
Base de datos no se crea
bash# Eliminar volúmenes y recrear
```
docker-compose down -v
docker-compose up --build
```
