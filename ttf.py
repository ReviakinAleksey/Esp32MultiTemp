from machine import Pin, SPI
import st7789
#import vga1_bold_16x16 as font
import vga1_8x16 as font


def config(rotation=0, buffer_size=0, options=0):
    return st7789.ST7789(
        SPI(2, baudrate=27000000, sck=Pin(18), mosi=Pin(19), miso=None),
        135,
        240,
        reset=Pin(23, Pin.OUT),
        cs=Pin(5, Pin.OUT),
        dc=Pin(16, Pin.OUT),
        backlight=Pin(4, Pin.OUT),
        rotation=rotation,
        options=options,
        buffer_size= buffer_size)
