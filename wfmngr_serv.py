import gc
import time

import network
import st7789
import uasyncio

import display
from microdot_asyncio import Microdot

AP_NAME = "ESP-AP"

DEV_MODE = True

display.fill_bg(st7789.RED)
display.write_text("Initializing", 1, 0, st7789.WHITE)
display.write_text("WIFI", 1, 1, st7789.WHITE)

if DEV_MODE:
    ap = network.WLAN(network.STA_IF)
    ap.active(True)
    ap.connect("Area 51C", "giga ukr")
else:
    ap = network.WLAN(network.AP_IF)  # create access-point interface
    ap.config(ssid=AP_NAME)  # set the SSID of the access point
    ap.config(max_clients=10)  # set how many clients can connect to the network
    ap.active(True)  # activate the interface

time.sleep(5)  # for some reason call ifconfig without pause crashes app
ap_ip = ap.ifconfig()[0]

display.fill_bg(st7789.BLUE)
display.write_text("Started config mode", 1, 0, st7789.WHITE)
display.write_text("WIFI SSID: {}".format(AP_NAME), 1, 1, st7789.WHITE)
display.write_text("Server IP: {}".format(ap_ip), 1, 2, st7789.WHITE)


class WifiManager:
    def __init__(self):
        self.http = None
        self.wlan = None
        self.networks = []

    async def http_networks(self, request):
        return self.networks

    async def http_connect(self, request):
        data = request.json
        connected = False
        if DEV_MODE:
            ap.connect(data["ssid"], data.get("password"))
            time.sleep(2)
            connected = ap.isconnected()
        else:
            self.wlan.active(False)
            self.wlan.active(True)
            # TODO: Check connection
            self.wlan.active(False)
        return {"connected": connected}

    def start(self):
        self.wlan = network.WLAN(network.STA_IF)
        self.http = Microdot()
        self.http.route("/api/networks")(self.http_networks)
        self.http.route("/api/connect", methods=['POST'])(self.http_connect)

    async def main_loop(self):
        uasyncio.create_task(self.wifi_loop())
        await self.http.start_server(port=80)

    async def wifi_loop(self):
        while True:
            gc.collect()
            # create station interface
            if DEV_MODE:
                scan_result = self.wlan.scan()
            else:
                self.wlan.active(False)
                self.wlan.active(True)
                scan_result = self.wlan.scan()
                self.wlan.active(False)
            rsp = []
            for item in scan_result:
                (ssid, bssid, channel, rssi, security, hidden) = item
                bssid = "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}".format(*bssid)
                rsp.append({"ssid": ssid, "bssid": bssid, "rssi": rssi, "security": security, "hidden": hidden})
            display.write_text("Found {} WIFI networks".format(len(rsp)), 1, 3, st7789.WHITE)
            self.networks = rsp
            gc.collect()
            await uasyncio.sleep_ms(2500)


mngr = WifiManager()
mngr.start()
uasyncio.run(mngr.main_loop())
gc.collect()
