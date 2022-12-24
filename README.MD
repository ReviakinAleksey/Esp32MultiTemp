# ESP32 multiple sensors temperature monitoring

Gather temperature from multiple DS18X20 sensors.
Monitor results using WEB interface.
Send metrics do MQTT broker.

## Compiling py code to mpy (optimized for board)
1. `pip install mpy-cross`
2. `python -m mpy_cross -march=xtensawin microdot_asyncio.py`

Result will be `microdot_asyncio.mpy` which could be uploaded to board.