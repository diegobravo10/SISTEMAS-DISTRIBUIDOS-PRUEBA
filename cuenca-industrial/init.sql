-- Tabla para histórico de alertas
CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    valor DECIMAL(10, 2),
    nivel VARCHAR(20) NOT NULL,
    mensaje TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar consultas
CREATE INDEX idx_alertas_timestamp ON alertas(timestamp DESC);
CREATE INDEX idx_alertas_sensor_id ON alertas(sensor_id);
CREATE INDEX idx_alertas_nivel ON alertas(nivel);
CREATE INDEX idx_alertas_tipo ON alertas(tipo);

-- Tabla para estadísticas de sensores
CREATE TABLE IF NOT EXISTS sensores_stats (
    sensor_id VARCHAR(50) PRIMARY KEY,
    ultima_lectura TIMESTAMP,
    total_alertas INTEGER DEFAULT 0,
    alertas_criticas INTEGER DEFAULT 0,
    alertas_advertencia INTEGER DEFAULT 0,
    alertas_normales INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista para dashboard
CREATE OR REPLACE VIEW vista_alertas_recientes AS
SELECT 
    a.id,
    a.sensor_id,
    a.tipo,
    a.valor,
    a.nivel,
    a.mensaje,
    a.timestamp,
    a.created_at
FROM alertas a
ORDER BY a.timestamp DESC
LIMIT 100;