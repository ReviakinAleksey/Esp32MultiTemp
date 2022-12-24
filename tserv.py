import gc
import time

import ds18x20
import machine
import network
import ntptime
import onewire
import uasyncio
from umqtt.simple import MQTTClient

from app_config import write_sensors_config, read_sensors_config, write_mqtt_config, read_wifi_config, read_mqtt_config
from microdot_asyncio import Microdot, send_file

UNIX_TIME_CORRECTION = 946684800

EMA_COEF = 31
EMA_MUL_CUR = 2
EMA_MUL_LAST = 29

wifi_config = read_wifi_config("home")
# wifi_config = read_wifi_config("work")
if not wifi_config:
    print("WIFI config error")

print("Connecting to WIFI: {}".format(wifi_config["ssid"]))
wlan_sta = network.WLAN(network.STA_IF)
wlan_sta.active(False)
wlan_sta.active(True)

wlan_sta.connect(wifi_config["ssid"], wifi_config["password"])

ip_addr = None
connected = False
for retry in range(100):
    connected = wlan_sta.isconnected()
    if connected:
        break
    time.sleep(0.1)

if connected:
    ip_addr = wlan_sta.ifconfig()[0]
    print(ip_addr)

ntptime.settime()
print("UNIX TIME:", time.time() + UNIX_TIME_CORRECTION)

gc.collect()


def rom_addr(ba):
    addr = "-".join(['{:x}'.format(int.from_bytes(ba[r * 2:(r + 1) * 2], "little")) for r in range(0, int(len(ba) / 2))])
    return addr


class TServ3:
    def __init__(self):
        self.ds = None
        self.sensors_list = None
        self.http = None
        self.mqtt = None
        self.mqtt_config = None
        self.raw_results = None
        self.prev_results = None
        self.ema_results = None

    async def http_temperature(self, request):
        type = request.args.get("type", "ema")
        if type == "ema" and self.ema_results:
            return self.ema_results
        elif type == "raw" and self.raw_results:
            return self.raw_results

    async def http_api_config(self, request):
        if request.method == 'POST':
            new_config = request.json
            for sid_str, new_info in new_config.items():
                sid = int(sid_str)
                self.sensors_list[sid]['name'] = new_info.get('name')
                self.sensors_list[sid]['field'] = new_info.get('field')
                self.sensors_list[sid]['color'] = new_info.get('color')
                self.sensors_list[sid]['cal'] = new_info.get('cal')
            write_sensors_config(self.sensors_list)
            self.clear_ema_results()
        return {"time-correction": UNIX_TIME_CORRECTION, "sensors-config": self.sensors_list}

    async def http_mqtt_config(self, request):
        if request.method == 'POST':
            new_config = request.json
            write_mqtt_config(new_config)
            self.mqtt_config = new_config
            self.mqtt_connect()
        return self.mqtt_config

    async def http_api_static(self, request, path):
        if path == 'main.js':
            return send_file('/files_temp_srv/main.js')
        else:
            return send_file('/files_temp_srv/index.html')

    def start(self):
        self.http = Microdot()
        self.http.route("/api/temperature")(self.http_temperature)
        self.http.route("/api/config", methods=['GET', 'POST'])(self.http_api_config)
        self.http.route("/api/mqtt_config", methods=['GET', 'POST'])(self.http_mqtt_config)
        self.http.route("<re:.*:path>")(self.http_api_static)

        ow = onewire.OneWire(machine.Pin(27))
        self.ds = ds18x20.DS18X20(ow)
        for _ in range(0, 10):
            read_sensors = self.ds.scan()
            time.sleep(0.05)

        prev_config_list = read_sensors_config()
        prev_config_dict = {}
        if prev_config_list:
            for idx, sensor_config in enumerate(prev_config_list):
                prev_config_dict[sensor_config['add_str']] = (idx, sensor_config)

        unordered = []
        self.sensors_list = {}
        for sid, sensor_addr in enumerate(read_sensors):
            addr = bytes(sensor_addr)
            addr_str = rom_addr(addr)
            print("Found sensor", addr_str)
            prev_sensor = prev_config_dict.get(addr_str)
            if prev_sensor is not None:
                prev_sensor[1]['addr'] = addr
                unordered.append(prev_sensor)
            else:
                unordered.append((sid + 100, {'addr': addr, 'add_str': addr_str, 'field': b'field{}'.format(sid + 1), 'cal': 0.0}))

        real_sid = 0
        for data in sorted(unordered, key=lambda data: data[0]):
            self.sensors_list[real_sid] = data[1]
            real_sid += 1
        self.prev_results = {}
        self.ema_results = []
        gc.collect()

    def mqtt_read_config(self):
        self.mqtt_config = None
        mqtt_conf = read_mqtt_config()
        if mqtt_conf:
            self.mqtt_config = mqtt_conf

    def mqtt_connect(self):
        if self.mqtt is not None:
            self.mqtt.disconnect()
            self.mqtt = None
        if self.mqtt_config:
            self.mqtt = MQTTClient(
                self.mqtt_config["client_name"],
                self.mqtt_config["broker_host"],
                port=self.mqtt_config["broker_port"],
                user=self.mqtt_config["user"],
                password=self.mqtt_config["password"],
                keepalive=self.mqtt_config["keepalive"])
            self.mqtt.connect()

    async def main_loop(self):
        uasyncio.create_task(self.sensors_loop())
        uasyncio.create_task(self.publish_mqt())
        await self.http.start_server(port=80)

    async def publish_mqt(self):
        while True:
            if self.mqtt is not None and len(self.ema_results):
                last_result = self.ema_results
                topic_data = []
                for idx, s_results in enumerate(last_result):
                    if idx == 0:
                        gd = time.gmtime(s_results)
                        topic_data.append(b'created_at={0}-{1:02d}-{2:02d}T{3:02d}:{4:02d}:{5:02d}Z'.format(*gd))
                        continue
                    sid = s_results[0]
                    info = self.sensors_list[sid]
                    if info.get('field') is None:
                        continue
                    temp_value = s_results[1]
                    topic_data.append(b'{}={}'.format(info["field"], temp_value))
                if len(topic_data) > 1:
                    self.mqtt.publish(self.mqtt_config["topic"], b"&".join(topic_data))
            await uasyncio.sleep(20)

    async def sensors_loop(self):
        while True:
            if len(self.sensors_list) > 0:
                curr_time = time.time()
                self.ds.convert_temp()
                self.ema_results = [curr_time]
                self.raw_results = [curr_time]
                step_results = self.prev_results
                if not step_results:
                    step_results = {}
                self.prev_results = {}
                for sid, info in self.sensors_list.items():
                    value = self.ds.read_temp(info['addr'])
                    self.raw_results.append(value)
                    if info.get('cal') is not None:
                        value += info['cal']
                    value = int(value * 100)
                    if sid in step_results:
                        value = ((EMA_MUL_CUR * value) + (EMA_MUL_LAST * step_results[sid])) / EMA_COEF
                    self.ema_results.append((sid, round(value / 100.0, 2)))
                    self.prev_results[sid] = value
                await uasyncio.sleep_ms(2000)

    def clear_ema_results(self):
        self.prev_results = None
        self.ema_results = None


print("Server staring")
srv3 = TServ3()
srv3.start()
srv3.mqtt_read_config()
srv3.mqtt_connect()
uasyncio.run(srv3.main_loop())
print("Server started")
