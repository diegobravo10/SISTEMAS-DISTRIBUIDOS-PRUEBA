# 🏭 Sistema de Monitoreo Industrial - Cuenca

Sistema distribuido en tiempo real para el monitoreo de seguridad industrial utilizando sensores IoT, mensajería asíncrona, WebSockets y almacenamiento persistente.

## 📋 Características

- ✅ **Sensores simulados** que generan eventos en tiempo real
- ✅ **RabbitMQ** como broker de mensajes
- ✅ **PostgreSQL** para almacenamiento histórico
- ✅ **WebSockets** para comunicación en tiempo real
- ✅ **Dashboard web** moderno y responsive
- ✅ **Docker Compose** para despliegue simplificado
- ✅ **Clasificación automática** de alertas (normal, advertencia, crítico)

## 🚀 Instalación y Ejecución

### Requisitos Previos

- Docker
- Docker Compose
- Puertos disponibles: 5672, 15672, 5432, 9000, 3000

### Estructura del Proyecto

```
cuenca-industrial/
├── docker-compose.yml
├── init.sql
├── sensores/
│   ├── Dockerfile
│   └── sensor_producer.py
├── procesador/
│   ├── Dockerfile
│   └── alert_processor.py
└── websocket-server/
    ├── Dockerfile
    ├── server.js
    └── public/
        └── index.html
```

### Paso 1: Crear la estructura de directorios

```bash
mkdir -p cuenca-industrial/{sensores,procesador,websocket-server/public}
cd cuenca-industrial
```

### Paso 2: Crear los archivos

Copia cada archivo en su ubicación correspondiente según la estructura anterior.

### Paso 3: Construir y ejecutar

```bash
# Construir las imágenes
docker-compose build

# Iniciar todos los servicios
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f
```

### Paso 4: Acceder al sistema

- **Dashboard Web**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (usuario: admin, contraseña: admin123)
- **WebSocket**: ws://localhost:9000
- **PostgreSQL**: localhost:5432

## 📊 Componentes del Sistema

### 1. Sensores (Productores MON)

Simulan 9 sensores diferentes:
- **S-101, S-102**: Sensores de temperatura (°C)
- **S-103, S-104**: Sensores de puertas
- **S-105, S-106**: Sensores de movimiento
- **S-107**: Sensor de humo (%)
- **S-108**: Sensor de vibración (Hz)
- **S-109**: Alarma manual

Cada sensor publica mensajes cada 3-7 segundos a RabbitMQ.

### 2. Procesador de Alertas (Consumidor MON)

- Consume mensajes de RabbitMQ
- Clasifica alertas según umbrales:
  - **Temperatura**: Crítico ≥45°C, Advertencia ≥35°C
  - **Humo**: Crítico ≥60%, Advertencia ≥30%
  - **Vibración**: Crítico ≥7Hz, Advertencia ≥5Hz
- Guarda en PostgreSQL
- Envía a WebSocket Server

### 3. Servidor WebSocket

- Recibe alertas del procesador
- Transmite en tiempo real a todos los clientes conectados
- Proporciona API REST para histórico

### 4. Cliente Web

Dashboard moderno que muestra:
- Estadísticas en tiempo real
- Lista de alertas con filtros
- Indicadores visuales de nivel de alerta
- Estado de conexión

## 🛠️ Comandos Útiles

```bash
# Ver estado de los servicios
docker-compose ps

# Ver logs de un servicio específico
docker-compose logs -f sensores
docker-compose logs -f procesador
docker-compose logs -f websocket-server

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (CUIDADO: borra la base de datos)
docker-compose down -v

# Reiniciar un servicio específico
docker-compose restart sensores

# Escalar sensores (crear múltiples instancias)
docker-compose up -d --scale sensores=3
```

## 🔍 Consultas SQL Útiles

Conectarse a PostgreSQL:
```bash
docker exec -it cuenca_postgres psql -U admin -d alertas_db
```

Consultas útiles:
```sql
-- Ver últimas 10 alertas
SELECT * FROM alertas ORDER BY timestamp DESC LIMIT 10;

-- Contar alertas por nivel
SELECT nivel, COUNT(*) FROM alertas GROUP BY nivel;

-- Ver alertas críticas del último día
SELECT * FROM alertas 
WHERE nivel = 'critico' 
AND timestamp > NOW() - INTERVAL '1 day'
ORDER BY timestamp DESC;

-- Estadísticas por sensor
SELECT * FROM sensores_stats ORDER BY total_alertas DESC;
```

## 📈 Monitoreo

### RabbitMQ Management Console

Accede a http://localhost:15672 para ver:
- Cantidad de mensajes en cola
- Rate de publicación/consumo
- Conexiones activas

### Logs del Sistema

Cada componente genera logs informativos:
- 🟢 Verde: Eventos normales
- 🟡 Amarillo: Advertencias
- 🔴 Rojo: Alertas críticas

## 🔧 Personalización

### Modificar umbrales de alertas

Edita `procesador/alert_processor.py` en la función `clasificar_alerta()`.

### Añadir nuevos sensores

Edita `sensores/sensor_producer.py` y añade entradas al array `SENSORES`.

### Cambiar frecuencia de lecturas

Modifica el `time.sleep()` en `sensor_producer.py`.

## 🐛 Solución de Problemas

### Los sensores no se conectan a RabbitMQ

```bash
# Verificar que RabbitMQ esté saludable
docker-compose logs rabbitmq

# Reiniciar el servicio
docker-compose restart rabbitmq sensores
```

### El dashboard no muestra alertas

1. Verificar conexión WebSocket en la consola del navegador
2. Revisar logs del procesador: `docker-compose logs procesador`
3. Verificar que el servidor WebSocket esté corriendo: `docker-compose logs websocket-server`

### Base de datos no guarda alertas

```bash
# Verificar conexión a PostgreSQL
docker-compose logs postgres procesador

# Revisar tablas
docker exec -it cuenca_postgres psql -U admin -d alertas_db -c "\dt"
```

## 📝 Arquitectura del Sistema

```
┌─────────────┐
│  Sensores   │ ──┐
│   (MON)     │   │
└─────────────┘   │
                  │
┌─────────────┐   │    ┌──────────────┐
│  Sensores   │ ──┼───▶│  RabbitMQ    │
│   (MON)     │   │    │   (Broker)   │
└─────────────┘   │    └──────────────┘
                  │           │
┌─────────────┐   │           ▼
│  Sensores   │ ──┘    ┌──────────────┐
│   (MON)     │        │  Procesador  │──┐
└─────────────┘        │   (MON)      │  │
                       └──────────────┘  │
                              │          │
                              ▼          │
                       ┌──────────────┐  │
                       │ PostgreSQL   │  │
                       │  (Histórico) │  │
                       └──────────────┘  │
                                         │
                                         ▼
                              ┌──────────────────┐
                              │ WebSocket Server │
                              └──────────────────┘
                                       │
                      ┌────────────────┼────────────────┐
                      ▼                ▼                ▼
                  ┌────────┐      ┌────────┐      ┌────────┐
                  │ Client │      │ Client │      │ Client │
                  │  Web   │      │  Web   │      │  Web   │
                  └────────┘      └────────┘      └────────┘
```

## 📄 Licencia

Este proyecto es de uso educativo para la Municipalidad de Cuenca.

## 👥 Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.