"""
本插件自带的发送脚本。

从 stdin 读取要发送的文本，用 pyautogui 在 Firefox 里模拟点击、粘贴、回车。

用法：
    echo "内容" | python send_to_ds.py --new-session 1

参数：
    --new-session 1  先按 Ctrl+J 创建新会话，再发送
    --new-session 0  在当前会话里发送

跨平台说明：
    - 不依赖 python 命令名，脚本自身由哪个解释器启动就用哪个
    - Linux 上 pyperclip 需要系统装 xclip 或 xsel
"""
import argparse
import random
import sys
import time

import pyautogui
import pyperclip
import pygetwindow as gw

pyautogui.PAUSE = 0.05

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

if hasattr(sys.stdin, "reconfigure"):
    try:
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass


def log(msg):
    print("[send_to_ds] " + msg, file=sys.stderr)


def find_firefox():
    titles = [
        "Mozilla Firefox",
        "Firefox",
        "Mozilla Firefox 隐私浏览",
    ]
    for title in titles:
        try:
            ws = gw.getWindowsWithTitle(title)
            if ws:
                return ws[0]
        except Exception:
            continue
    return None


def activate_window(win):
    if win.isMinimized:
        win.restore()
        time.sleep(0.5)
    try:
        win.activate()
    except Exception:
        try:
            pyautogui.click(win.left + 100, win.top + 15)
        except Exception:
            pass
    time.sleep(random.uniform(0.8, 1.2))


def click_input_box(win, prefer_center):
    """点击输入框。prefer_center=True 表示点页面中央，否则点底部。"""
    left = win.left + 4
    top = win.top + 32
    width = win.width - 8
    height = win.height - 36
    cx = left + width // 2

    if prefer_center:
        cy = top + int(height * 0.48)
        label = "中央"
    else:
        cy = top + int(height * 0.85)
        label = "底部"

    log("点击输入框（" + label + "）：(" + str(cx) + ", " + str(cy) + ")")
    pyautogui.click(cx, cy)
    time.sleep(random.uniform(0.6, 1.0))


def clear_and_paste(text):
    """清空输入框，粘贴内容。"""
    pyautogui.hotkey("ctrl", "a")
    time.sleep(0.2)
    pyautogui.press("delete")
    time.sleep(0.3)

    pyperclip.copy(text)
    time.sleep(random.uniform(0.3, 0.6))
    log("Ctrl+V 粘贴 " + str(len(text)) + " 字符")
    pyautogui.hotkey("ctrl", "v")
    # 按内容长度动态等待，让浏览器把长文本完整渲染进输入框
    wait = min(6.0, 1.2 + len(text) / 1000.0 * 0.4)
    log("等待渲染 " + str(round(wait, 1)) + " 秒")
    time.sleep(wait)


def send(text: str, is_new_session: bool) -> None:
    win = find_firefox()
    if win is None:
        log("未找到 Firefox 窗口")
        sys.exit(1)

    log("激活 Firefox 窗口：" + win.title)
    activate_window(win)

    if is_new_session:
        # 真正创建新会话：按 Ctrl+J
        log("按 Ctrl+J 创建新会话")
        pyautogui.hotkey("ctrl", "j")
        log("等待页面切换（2 秒）...")
        time.sleep(2.0)

        # 页面切换后，新会话输入框通常在页面中央
        click_input_box(win, prefer_center=True)
    else:
        click_input_box(win, prefer_center=False)

    clear_and_paste(text)

    log("按 Enter 发送")
    pyautogui.press("enter")
    time.sleep(0.5)
    log("sent")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--new-session", default="0")
    args = ap.parse_args()

    text = sys.stdin.read()
    if not text.strip():
        log("stdin 为空")
        sys.exit(2)

    send(text, args.new_session == "1")


if __name__ == "__main__":
    main()
