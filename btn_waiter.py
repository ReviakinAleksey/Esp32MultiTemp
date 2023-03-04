import machine
import uasyncio

BUTTON_PRESSED = 0

left_pin = machine.Pin(0, machine.Pin.IN, machine.Pin.PULL_UP)
right_pin = machine.Pin(35, machine.Pin.IN, machine.Pin.PULL_UP)


async def read_buttons_state(state):
    while True:
        pressed_before = left_pin.value() == BUTTON_PRESSED and right_pin.value() == BUTTON_PRESSED
        await uasyncio.sleep_ms(10)
        if pressed_before:
            pressed_after = left_pin.value() == BUTTON_PRESSED and right_pin.value() == BUTTON_PRESSED
            state["pressed"] = pressed_before and pressed_after
            await uasyncio.sleep_ms(10)
        else:
            state["pressed"] = False


async def count_down(seconds, state):
    left = seconds
    while left > 0 and state["pressed"] == False:
        print("Booting after: {}s (press 2 buttons to cancel)".format(left))
        left -= 1
        await uasyncio.sleep_ms(1 * 1000)


async def main(delay_seconds):
    state = {"pressed": False}
    count_wait = uasyncio.create_task(count_down(delay_seconds, state))
    uasyncio.create_task(read_buttons_state(state))
    await count_wait
    return state["pressed"]


def wait_for_buttons(delay_seconds):
    return uasyncio.run(main(delay_seconds))
