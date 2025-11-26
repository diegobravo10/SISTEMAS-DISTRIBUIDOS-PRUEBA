FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pika

COPY sensor_producer.py .

CMD ["python", "sensor_producer.py"]