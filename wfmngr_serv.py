import gc
import time

import network
import st7789
import uasyncio

import display
from app_config import write_wifi_config, schedule_reboot
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
        self.connecting = False
        self.networks = []

    async def http_networks(self, request):
        return self.networks

    async def http_connect(self, request):
        data = request.json
        ssid = data["ssid"]
        password = data.get("password")
        connected = False
        self.connecting = True
        rsp = None
        try:
            if DEV_MODE:
                await uasyncio.sleep_ms(2000)
                rsp = {"connected": True, "ssid": ssid, "status": network.STAT_GOT_IP, "ip": ap.ifconfig()[0]}
            else:
                print("Connecting", ssid, password)
                self.wlan.active(True)
                self.wlan.connect(ssid, password)  # connect to an AP
                last_status = 999999
                connected = False
                for retry in range(40):
                    connected = self.wlan.isconnected()
                    last_status = self.wlan.status()
                    print("Status", last_status, connected, ssid, password)
                    if connected:
                        break
                    await uasyncio.sleep_ms(500)
                self.wlan.active(False)
                gc.collect()
                if connected:
                    rsp = {"connected": True, "ssid": ssid, "status": last_status, "ip": self.wlan.ifconfig()[0]}
                else:
                    rsp = {"connected": False, "ssid": ssid, "status": last_status}
        finally:
            self.connecting = False

        return rsp

    async def save_and_restart(self, request):
        data = request.json
        write_wifi_config(data)
        schedule_reboot(2000)
        return {"ok": True}

    def start(self):
        self.wlan = network.WLAN(network.STA_IF)
        self.http = Microdot()
        self.http.route("/api/networks")(self.http_networks)
        self.http.route("/api/connect", methods=['POST'])(self.http_connect)
        self.http.route("/api/apply", methods=['POST'])(self.save_and_restart)

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
