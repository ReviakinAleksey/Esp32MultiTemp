import gc
import os

from app_config import read_wifi_config
from btn_waiter import wait_for_buttons

boot_to_interpreter = wait_for_buttons(10)
gc.collect()

if not boot_to_interpreter:
    wifi_config = read_wifi_config()
    if wifi_config != False:
        print("Wifi config found, starting server mode")
        program_module = "tserv"
    else:
        print("Wifi config missing, starting WIFI manager mode")
        program_module = "wfmngr_serv"

    lst = os.listdir()
    if '{}.py'.format(program_module) in os.listdir():
        __import__(program_module)
    else:
        print('Could not found {}.py'.format(program_module))
else:
    print("Boot to interpreter...")
