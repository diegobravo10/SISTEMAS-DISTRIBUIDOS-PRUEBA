import pika
import json
import psycopg2
import websocket
import time
import os
from datetime import datetime

# Configuración
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'admin')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'admin123')
QUEUE_NAME = 'sensores_queue'

POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_DB = os.getenv('POSTGRES_DB', 'alertas_db')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'admin')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'admin123')

WS_SERVER_URL = os.getenv('WS_SERVER_URL', 'ws://localhost:9000')

class AlertProcessor:
    def __init__(self):
        self.db_conn = None
        self.ws = None
        self.rabbit_connection = None
        self.rabbit_channel = None
        
    def conectar_postgres(self):
        """Conecta a PostgreSQL"""
        print("Conectando a PostgreSQL...")
        for intento in range(10):
            try:
                self.db_conn = psycopg2.connect(
                    host=POSTGRES_HOST,
                    database=POSTGRES_DB,
                    user=POSTGRES_USER,
                    password=POSTGRES_PASSWORD
                )
                print("✓ Conexión establecida con PostgreSQL")
                return
            except Exception as e:
                print(f"Intento {intento + 1}/10 falló: {e}")
                time.sleep(5)
        raise Exception("No se pudo conectar a PostgreSQL")
    
    def conectar_websocket(self):
        """Conecta al servidor WebSocket"""
        print(f"Conectando a WebSocket en {WS_SERVER_URL}...")
        try:
            self.ws = websocket.create_connection(WS_SERVER_URL)
            print("✓ Conexión establecida con WebSocket Server")
        except Exception as e:
            print(f"⚠️  No se pudo conectar al WebSocket: {e}")
            self.ws = None
    
    def conectar_rabbitmq(self):
        """Conecta a RabbitMQ"""
        print(f"Conectando a RabbitMQ en {RABBITMQ_HOST}...")
        for intento in range(10):
            try:
                credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
                parameters = pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
                self.rabbit_connection = pika.BlockingConnection(parameters)
                self.rabbit_channel = self.rabbit_connection.channel()
                self.rabbit_channel.queue_declare(queue=QUEUE_NAME, durable=True)
                print("✓ Conexión establecida con RabbitMQ")
                return
            except Exception as e:
                print(f"Intento {intento + 1}/10 falló: {e}")
                time.sleep(5)
        raise Exception("No se pudo conectar a RabbitMQ")
    
    def clasificar_alerta(self, mensaje):
        """Clasifica la alerta según el tipo y valor"""
        tipo = mensaje.get('tipo')
        valor = mensaje.get('valor')
        
        # Temperatura
        if tipo == 'temperatura':
            if isinstance(valor, (int, float)):
                if valor >= 45:
                    return 'critico', f"🔥 Temperatura crítica: {valor}°C supera el límite de 45°C"
                elif valor >= 35:
                    return 'advertencia', f"⚠️  Temperatura elevada: {valor}°C"
                else:
                    return 'normal', f"✓ Temperatura normal: {valor}°C"
        
        # Puerta
        elif tipo == 'puerta':
            if valor == 'abierta':
                return 'advertencia', f"🚪 Puerta abierta detectada"
            else:
                return 'normal', f"✓ Puerta cerrada"
        
        # Movimiento
        elif tipo == 'movimiento':
            if valor == 'detectado':
                return 'advertencia', f"👤 Movimiento detectado"
            else:
                return 'normal', f"✓ Sin movimiento"
        
        # Humo
        elif tipo == 'humo':
            if isinstance(valor, (int, float)):
                if valor >= 60:
                    return 'critico', f"🔥 Nivel crítico de humo: {valor}%"
                elif valor >= 30:
                    return 'advertencia', f"⚠️  Humo detectado: {valor}%"
                else:
                    return 'normal', f"✓ Nivel normal de humo: {valor}%"
        
        # Vibración
        elif tipo == 'vibración':
            if isinstance(valor, (int, float)):
                if valor >= 7:
                    return 'critico', f"⚡ Vibración crítica: {valor} Hz"
                elif valor >= 5:
                    return 'advertencia', f"⚠️  Vibración elevada: {valor} Hz"
                else:
                    return 'normal', f"✓ Vibración normal: {valor} Hz"
        
        # Alarma manual
        elif tipo == 'alarma_manual':
            if valor == 'activada':
                return 'critico', f"🚨 ALARMA MANUAL ACTIVADA"
            else:
                return 'normal', f"✓ Alarma desactivada"
        
        return 'normal', f"Evento: {tipo}"
    
    def guardar_en_db(self, sensor_id, tipo, valor, nivel, mensaje, timestamp):
        """Guarda la alerta en la base de datos"""
        try:
            cursor = self.db_conn.cursor()
            
            # Convertir valor a decimal si es numérico
            valor_db = valor if isinstance(valor, (int, float)) else None
            
            cursor.execute("""
                INSERT INTO alertas (sensor_id, tipo, valor, nivel, mensaje, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (sensor_id, tipo, valor_db, nivel, mensaje, timestamp))
            
            # Actualizar estadísticas del sensor
            cursor.execute("""
                INSERT INTO sensores_stats (sensor_id, ultima_lectura, total_alertas, 
                                           alertas_criticas, alertas_advertencia, alertas_normales)
                VALUES (%s, %s, 1, 
                        CASE WHEN %s = 'critico' THEN 1 ELSE 0 END,
                        CASE WHEN %s = 'advertencia' THEN 1 ELSE 0 END,
                        CASE WHEN %s = 'normal' THEN 1 ELSE 0 END)
                ON CONFLICT (sensor_id) DO UPDATE SET
                    ultima_lectura = EXCLUDED.ultima_lectura,
                    total_alertas = sensores_stats.total_alertas + 1,
                    alertas_criticas = sensores_stats.alertas_criticas + EXCLUDED.alertas_criticas,
                    alertas_advertencia = sensores_stats.alertas_advertencia + EXCLUDED.alertas_advertencia,
                    alertas_normales = sensores_stats.alertas_normales + EXCLUDED.alertas_normales,
                    updated_at = CURRENT_TIMESTAMP
            """, (sensor_id, timestamp, nivel, nivel, nivel))
            
            self.db_conn.commit()
            cursor.close()
            
        except Exception as e:
            print(f"Error guardando en DB: {e}")
            self.db_conn.rollback()
    
    def enviar_a_websocket(self, alerta):
        """Envía la alerta al servidor WebSocket"""
        if not self.ws:
            self.conectar_websocket()
        
        if self.ws:
            try:
                self.ws.send(json.dumps(alerta))
            except Exception as e:
                print(f"Error enviando a WebSocket: {e}")
                self.ws = None
    
    def procesar_mensaje(self, ch, method, properties, body):
        """Procesa un mensaje del sensor"""
        try:
            mensaje = json.loads(body)
            
            # Clasificar alerta
            nivel, texto_alerta = self.clasificar_alerta(mensaje)
            
            # Crear alerta procesada
            alerta = {
                'sensor_id': mensaje.get('sensor_id'),
                'tipo': mensaje.get('tipo'),
                'valor': mensaje.get('valor'),
                'unidad': mensaje.get('unidad', ''),
                'ubicacion': mensaje.get('ubicacion', ''),
                'nivel': nivel,
                'mensaje': texto_alerta,
                'timestamp': mensaje.get('timestamp', datetime.utcnow().isoformat() + 'Z')
            }
            
            # Guardar en base de datos
            self.guardar_en_db(
                alerta['sensor_id'],
                alerta['tipo'],
                alerta['valor'],
                alerta['nivel'],
                alerta['mensaje'],
                alerta['timestamp']
            )
            
            # Enviar a WebSocket
            self.enviar_a_websocket(alerta)
            
            # Log
            emoji = '🔴' if nivel == 'critico' else '🟡' if nivel == 'advertencia' else '🟢'
            print(f"{emoji} [{alerta['sensor_id']}] {alerta['mensaje']}")
            
            # Acknowledge
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            print(f"Error procesando mensaje: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def iniciar(self):
        """Inicia el procesador de alertas"""
        self.conectar_postgres()
        self.conectar_websocket()
        self.conectar_rabbitmq()
        
        print("\n" + "="*60)
        print("🖥️  PROCESADOR DE ALERTAS - CUENCA INDUSTRIAL")
        print("="*60)
        print("Esperando mensajes de sensores...\n")
        
        # Configurar consumidor
        self.rabbit_channel.basic_qos(prefetch_count=1)
        self.rabbit_channel.basic_consume(
            queue=QUEUE_NAME,
            on_message_callback=self.procesar_mensaje
        )
        
        try:
            self.rabbit_channel.start_consuming()
        except KeyboardInterrupt:
            print("\n\n⚠️  Deteniendo procesador...")
            self.rabbit_channel.stop_consuming()
        finally:
            if self.db_conn:
                self.db_conn.close()
            if self.ws:
                self.ws.close()
            if self.rabbit_connection:
                self.rabbit_connection.close()
            print("✓ Conexiones cerradas")

if __name__ == '__main__':
    processor = AlertProcessor()
    processor.iniciar()