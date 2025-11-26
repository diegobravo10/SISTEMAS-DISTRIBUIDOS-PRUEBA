FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pika psycopg2-binary websocket-client

COPY alert_processor.py .

CMD ["python", "alert_processor.py"]