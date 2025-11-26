import asyncio
import websockets

clients = set()

async def handler(ws, path):
    clients.add(ws)
    print("Cliente conectado")

    try:
        async for msg in ws:
            # Reenviar a todos los clientes
            for c in list(clients):
                if c.open:
                    await c.send(msg)
    except:
        pass
    finally:
        clients.remove(ws)
        print("Cliente desconectado")

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8000):
        print("Servidor WebSocket en puerto 8000")
        await asyncio.Future()

asyncio.run(main())
