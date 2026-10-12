"""独立链路测试 v2：会话隔离验证。

修正了 v1 的问题：ds_read.py --latest 会读到 agent 主会话，
而不是 dev-test 自己刚创建的新会话。

v2 的流程：
  1. 发送前：记录 --list 里所有会话 id
  2. 发送：pyautogui 点击 + 粘贴 + 回车
  3. 等待：15 秒
  4. 发送后：再 --list 一次，找出新增的会话 id
  5. 用 --session <新id> 精确读取那个会话，解析回复
"""
import json
import os
import subprocess
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PY314 = r'C:\Users\Lenovo\AppData\Local\Programs\Python\Python314\python.exe'
HERE = os.path.dirname(os.path.abspath(__file__))
SEND = os.path.join(HERE, 'scripts', 'send_to_ds.py')
DS_READ = r'C:\Users\Lenovo\SKILL_web-ds-read\scripts\ds_read.py'


def step(title):
    print()
    print('=' * 70)
    print('  ' + title)
    print('=' * 70)


def list_sessions():
    """返回 {id: updated_at} 字典。"""
    proc = subprocess.run(
        [PY314, DS_READ, '--list', '--limit', '30', '--raw'],
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=60,
    )
    if proc.returncode != 0:
        print('  ds_read.py --list 失败：' + (proc.stderr or '')[:300])
        return {}
    try:
        rows = json.loads(proc.stdout or '[]')
    except Exception as e:
        print('  解析 --list JSON 失败：' + str(e))
        return {}
    out = {}
    for r in rows:
        sid = r.get('id')
        if sid:
            out[sid] = r.get('updated_at', 0)
    return out


step('0. 环境检查')
for p, label in [(PY314, 'Python 3.14'), (SEND, 'send_to_ds.py'),
                 (DS_READ, 'ds_read.py')]:
    ok = os.path.isfile(p)
    print('  ' + label.ljust(20) + '  ' + ('✓' if ok else '✗') + '  ' + p)
    if not ok:
        sys.exit(1)

step('1. 记录发送前的会话集合')
before = list_sessions()
print('  当前会话数：' + str(len(before)))
for sid in list(before.keys())[:5]:
    print('    ' + sid)

# ── 2. 发送 ─────────────────────────────
step('2. 发送测试消息到网页版 DeepSeek')
test_msg = '请只回复四个字：链路正常。不要调用任何工具。'
print('消息内容：' + test_msg)
print('（请确认 Firefox 已打开并登录 chat.deepseek.com）')
time.sleep(2)

proc = subprocess.run(
    [PY314, SEND, '--new-session', '1'],
    input=test_msg,
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    timeout=60,
)
print('  发送返回码：' + str(proc.returncode))
if proc.stderr:
    print('  stderr：' + proc.stderr[:300])
if proc.returncode != 0:
    sys.exit(2)

# ── 3. 等待 ─────────────────────────────
step('3. 等待回复（20 秒，让新会话建立 + 生成完毕）')
for i in range(20, 0, -1):
    if i % 5 == 0 or i <= 5:
        print('  ' + str(i).rjust(2) + ' 秒...')
    time.sleep(1)

# ── 4. 找出新会话 ───────────────────────
step('4. 找出新增的会话')
after = list_sessions()
print('  发送后会话数：' + str(len(after)))

new_ids = [sid for sid in after if sid not in before]
print('  新增会话数：' + str(len(new_ids)))
if new_ids:
    for sid in new_ids:
        print('    ★ ' + sid)
else:
    print('  ⚠ 没有新增会话')
    print('  可能原因：')
    print('    1. send_to_ds.py 的"新会话"点击没生效，消息发到了当前会话')
    print('    2. 网页版创建会话有延迟，20 秒还不够')
    print('    3. ds_read.py 缓存了会话列表，没刷新')

# ── 5. 读取目标会话 ─────────────────────
step('5. 读取目标会话的回复')

if new_ids:
    target = new_ids[0]
    print('  使用新会话：' + target)
elif len(after) > len(before):
    target = max(after, key=lambda s: after[s])
    print('  使用 updated_at 最新的会话：' + target)
else:
    # 兜底：用 --latest
    print('  没有新增会话，退回 --latest 兜底（可能读到主会话）')
    target = None

if target:
    proc2 = subprocess.run(
        [PY314, DS_READ, '--session', target, '--raw'],
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=120,
    )
else:
    proc2 = subprocess.run(
        [PY314, DS_READ, '--latest', '--raw'],
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=120,
    )

if proc2.returncode != 0:
    print('  读取失败：' + (proc2.stderr or '')[:500])
    sys.exit(3)

# ── 6. 解析 ────────────────────────────
step('6. 解析回复')
try:
    data = json.loads(proc2.stdout or '{}')
except json.JSONDecodeError as e:
    print('  JSON 解析失败：' + str(e))
    sys.exit(4)

messages = data.get('chat_messages') or []
print('  消息数：' + str(len(messages)))

by_id = {m.get('message_id'): m for m in messages}
session = data.get('chat_session') or {}
cur = session.get('current_message_id')
chain = []
seen = set()
while cur and by_id.get(cur) and cur not in seen:
    seen.add(cur)
    chain.append(by_id[cur])
    cur = by_id[cur].get('parent_id')
chain.reverse()
if not chain:
    chain = messages

found = False
for msg in reversed(chain):
    for fr in msg.get('fragments') or []:
        if fr.get('type') == 'RESPONSE':
            content = (fr.get('content') or '').strip()
            if content:
                print()
                print('  ┌─ 读到的回复 ────────────────')
                for line in content.split('\n'):
                    print('  │ ' + line)
                print('  └─────────────────────────────')
                found = True
                break
    if found:
        break

if not found:
    print('  ⚠ 没有找到 RESPONSE 片段')
    sys.exit(5)

# ── 7. 结果判定 ────────────────────────
step('7. 判定')
reply_text = content
if '链路正常' in reply_text:
    print('  ✓ 成功：DeepSeek 回复了目标文本"链路正常"')
    print()
    print('  核心链路完全验证：')
    print('    pyautogui 发送 → 网页版 DeepSeek → ds_read 精确读取 → 解析 ✓')
    print()
    print('  下一步：在 cordis.patch.yml 里把 provider 改成 web-ds。')
else:
    print('  ⚠ 读到的内容不包含"链路正常"')
    print('  这说明读到的可能不是 dev-test 自己发的那个会话')
    print('  或者 DeepSeek 回复了别的内容')
    print()
    print('  请把这次打印的完整输出贴给助手，包括：')
    print('    - 新增会话 id')
    print('    - 读到的回复内容')
    sys.exit(6)
