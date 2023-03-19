import json
import os

import machine


def file_exists(path_to_file):
    try:
        return (os.stat(path_to_file)[0] & 0x4000) == 0
    except OSError:
        return False


def remove_wifi_config(profile):
    os.remove(wifi_file_name(profile))


def write_sensors_config(data):
    write_data = clean_sensors_dict(data)
    if not write_data:
        raise ValueError

    config_list = []
    for key in sorted(write_data):
        config_list.append(write_data[key])
    with open('sensors_config.json', 'w') as f:
        f.write(json.dumps(config_list))


def read_sensors_config():
    try:
        with open('sensors_config.json', 'r') as f:
            content = f.read()
            config = json.loads(content)
            if not type(config) is list:
                return False
            for sensor_config in config:
                if not clean_sensor_config(sensor_config):
                    return False
            return config
    except:
        return False


def clean_sensors_dict(sensors_dict):
    if not type(sensors_dict) is dict:
        return False
    result = {}
    for idx, sensor_config in sensors_dict.items():
        if not type(idx) is int:
            return False
        config_to_save = clean_sensor_config(sensor_config)
        if not config_to_save:
            return False
        result[idx] = config_to_save
    return result


def clean_sensor_config(config):
    if not type(config) is dict:
        return False
    if 'add_str' not in config:
        return False
    if 'cal' not in config:
        return False
    result = config.copy()
    if 'addr' in config:
        result.pop('addr')
    return result


def write_wifi_config(data, profile=None):
    write_json_config(wifi_file_name(profile), data, wifi_config_invalid)


def read_wifi_config(profile=None):
    return read_json_config(wifi_file_name(profile), wifi_config_invalid)


def wifi_config_invalid(config):
    return "ssid" not in config or "password" not in config


def wifi_file_name(profile=None):
    return config_name("wifi_config", profile)


def read_mqtt_config(profile=None):
    return read_json_config(mqtt_config_name(profile), mqtt_config_invalid)


def write_mqtt_config(data, profile=None):
    return write_json_config(mqtt_config_name(profile), data, mqtt_config_invalid)


def mqtt_config_name(profile=None):
    return config_name("mqtt_config", profile)


def mqtt_config_invalid(config):
    fields = ["client_name", "broker_host", "broker_port", "user", "password", "keepalive", "topic"]
    for filed in fields:
        if filed not in config:
            return True
    return False


def schedule_reboot(after_ms):
    tim0 = machine.Timer(0)
    tim0.init(period=after_ms, mode=machine.Timer.ONE_SHOT, callback=lambda t: machine.reset())


def config_name(config_name_base, profile=None):
    file_name = config_name_base
    if profile is not None:
        file_name = "{}_{}".format(file_name, profile)
    return "{0}.json".format(file_name)


def read_json_config(file_name, invalid_check):
    try:
        with open(file_name, 'r') as f:
            content = f.read()
            config = json.loads(content)
            if invalid_check(config):
                return False
            return config
    except:
        return False


def write_json_config(filename, data, invalid_check):
    if invalid_check(data):
        raise ValueError
    with open(filename, 'w') as f:
        f.write(json.dumps(data))
