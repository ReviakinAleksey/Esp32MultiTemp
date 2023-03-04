import gc
import os

import machine
import uasyncio

from app_config import read_wifi_config

INIT_DELAY = 10
BUTTON_PRESSED = 0

left_pin = machine.Pin(0, machine.Pin.IN, machine.Pin.PULL_UP)
right_pin = machine.Pin(35, machine.Pin.IN, machine.Pin.PULL_UP)


async def read_buttons_state(state):
    while True:
        pressed_before = left_pin.value() == BUTTON_PRESSED and right_pin.value() == BUTTON_PRESSED
        await uasyncio.sleep_ms(10)
        if pressed_before:
            pressed_after = left_pin.value() == BUTTON_PRESSED and right_pin.value() == BUTTON_PRESSED
            state["interpreter"] = pressed_before and pressed_after
            await uasyncio.sleep_ms(10)
        else:
            state["interpreter"] = False


async def count_down(seconds, state):
    left = seconds
    while left > 0 and state["interpreter"] == False:
        print("Booting after: {}s (press 2 buttons to cancel)".format(left))
        left -= 1
        await uasyncio.sleep_ms(1 * 1000)


async def main():
    state = {"interpreter": False}
    count_wait = uasyncio.create_task(count_down(INIT_DELAY, state))
    uasyncio.create_task(read_buttons_state(state))
    await count_wait
    return state["interpreter"]


boot_to_interpreter = uasyncio.run(main())
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