# ESP32 multiple sensors temperature monitoring

Gather temperature from multiple DS18X20 sensors.
Monitor results using WEB interface.
Send metrics do MQTT broker.

## Run temperature monitoring UI in dev mode
1. Enter `ui/temperature`
2. Run `npm install` (for first time or if dependencies changes)
3. Start dev server `ESP32_IP=10.10.11.12 npm run dev` (where 10.10.11.12 is IP of ESP32 board running [tserv.py](tserv.py) code)

## Compiling py code to mpy (optimized for board)
1. `pip install mpy-cross`
2. `python -m mpy_cross -march=xtensawin microdot_asyncio.py`

Result will be `microdot_asyncio.mpy` which could be uploaded to board.