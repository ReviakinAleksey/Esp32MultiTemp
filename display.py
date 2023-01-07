import st7789

import ttf

print("INIT DISPLAY")
device = ttf.config(1)
device.init()

col_count = device.width() / 8
row_count = device.height() / 16

fx = device.width() / col_count
fy =  device.height() / row_count

current_bg = st7789.BLACK


def fill_bg(color):
    global current_bg
    current_bg = color
    device.fill(color)


def write_text(text, col, row, text_color=None, fg_color=None):
    if text_color is None:
        text_color = st7789.WHITE
    if fg_color is None:
        fg_color = current_bg
    device.text(ttf.font, text, int(fx * col), int(fy * row), text_color, fg_color)
