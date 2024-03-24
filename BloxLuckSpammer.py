import socketio
import string
import random
import time

sio = socketio.Client()
message = "Modern Site no tax => 𝖻𝗅𝗈𝗑𝗒𝗉𝗅𝗎𝗌.𝖼𝗈𝗆"
auth = "65e7c7bc14bd27.18300036"

@sio.event
def connect():
    print('Connected to server')

    sio.emit("authenticate", auth)

@sio.event
def disconnect():
    print('Disconnected from server')

@sio.event
def chat_message(msg):
    print('Received message:', msg)

sio.connect('https://chat1.bloxluck.com')

while True:
    sio.emit('chat message', message + ' ' + ''.join(random.choice(string.ascii_letters) for _ in range(3)))
    time.sleep(1)