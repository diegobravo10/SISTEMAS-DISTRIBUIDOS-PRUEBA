import pika
import json
import random
import time
from datetime import datetime
import os

# Configuración de RabbitMQ
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'admin')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'admin123')
QUEUE_NAME = 'sensores_queue'

# Tipos de sensores
SENSORES = [
    {'id': 'S-101', 'tipo': 'temperatura', 'ubicacion': 'Parque Industrial Norte'},
    {'id': 'S-102', 'tipo': 'temperatura', 'ubicacion': 'Parque Industrial Sur'},
    {'id': 'S-103', 'tipo': 'puerta', 'ubicacion': 'Entrada Principal'},
    {'id': 'S-104', 'tipo': 'puerta', 'ubicacion': 'Bodega A'},
    {'id': 'S-105', 'tipo': 'movimiento', 'ubicacion': 'Zona de Carga'},
    {'id': 'S-106', 'tipo': 'movimiento', 'ubicacion': 'Perímetro Este'},
    {'id': 'S-107', 'tipo': 'humo', 'ubicacion': 'Planta de Procesamiento'},
    {'id': 'S-108', 'tipo': 'vibración', 'ubicacion': 'Maquinaria Pesada'},
    {'id': 'S-109', 'tipo': 'alarma_manual', 'ubicacion': 'Oficinas Centrales'},
]

def generar_lectura(sensor):
    """Genera una lectura aleatoria según el tipo de sensor"""
    timestamp = datetime.utcnow().isoformat() + 'Z'
    
    if sensor['tipo'] == 'temperatura':
        # Temperatura entre 15 y 55 grados
        valor = round(random.uniform(15, 55), 1)
        return {
            'sensor_id': sensor['id'],
            'tipo': sensor['tipo'],
            'valor': valor,
            'unidad': '°C',
            'ubicacion': sensor['ubicacion'],
            'timestamp': timestamp
        }
    
    elif sensor['tipo'] == 'puerta':
        estados = ['abierta', 'cerrada']
        return {
            'sensor_id': sensor['id'],
            'tipo': sensor['tipo'],
            'valor': random.choice(estados),
            'ubicacion': sensor['ubicacion'],
            'timestamp': timestamp
        }
    
    elif sensor['tipo'] == 'movimiento':
        return {
            'sensor_id': sensor['id'],
            'tipo': sensor['tipo'],
            'valor': 'detectado' if random.random() > 0.7 else 'sin_movimiento',
            'ubicacion': sensor['ubicacion'],
            'timestamp': timestamp
        }
    
    elif sensor['tipo'] == 'humo':
        # Nivel de humo entre 0 y 100
        valor = round(random.uniform(0, 100), 1)
        return {
            'sensor_id': sensor['id'],
            'tipo': sensor['tipo'],
            'valor': valor,
            'unidad': '%',
            'ubicacion': sensor['ubicacion'],
            'timestamp': timestamp
        }
    
    elif sensor['tipo'] == 'vibración':
        # Nivel de vibración entre 0 y 10
        valor = round(random.uniform(0, 10), 2)
        return {
            'sensor_id': sensor['id'],
            'tipo': sensor['tipo'],
            'valor': valor,
            'unidad': 'Hz',
            'ubicacion': sensor['ubicacion'],
            'timestamp': timestamp
        }
    
    elif sensor['tipo'] == 'alarma_manual':
        return {
            'sensor_id': sensor['id'],
            'tipo': sensor['tipo'],
            'valor': 'activada' if random.random() > 0.95 else 'desactivada',
            'ubicacion': sensor['ubicacion'],
            'timestamp': timestamp
        }

def conectar_rabbitmq():
    """Establece conexión con RabbitMQ"""
    print(f"Conectando a RabbitMQ en {RABBITMQ_HOST}...")
    
    # Reintentar conexión
    for intento in range(10):
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            
            # Declarar la cola
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            
            print("✓ Conexión establecida con RabbitMQ")
            return connection, channel
        
        except Exception as e:
            print(f"Intento {intento + 1}/10 falló: {e}")
            time.sleep(5)
    
    raise Exception("No se pudo conectar a RabbitMQ")

def main():
    connection, channel = conectar_rabbitmq()
    
    print("\n" + "="*60)
    print("🏭 SISTEMA DE SENSORES - CUENCA INDUSTRIAL")
    print("="*60)
    print(f"Sensores activos: {len(SENSORES)}")
    print("Publicando lecturas cada 3-7 segundos...\n")
    
    try:
        contador = 0
        while True:
            # Seleccionar sensor aleatorio
            sensor = random.choice(SENSORES)
            lectura = generar_lectura(sensor)
            
            # Publicar mensaje
            channel.basic_publish(
                exchange='',
                routing_key=QUEUE_NAME,
                body=json.dumps(lectura),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Mensaje persistente
                )
            )
            
            contador += 1
            print(f"[{contador}] 📡 {sensor['id']} ({sensor['tipo']}): {lectura['valor']} - {lectura['ubicacion']}")
            
            # Esperar tiempo aleatorio entre lecturas
            time.sleep(random.uniform(3, 7))
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Deteniendo sensores...")
    
    finally:
        connection.close()
        print("✓ Conexión cerrada")

if __name__ == '__main__':
    main()