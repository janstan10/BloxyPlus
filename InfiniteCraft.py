import requests

url = 'https://chatgptespanol.app/wp-admin/admin-ajax.php'

headers = {
    'content-type': 'multipart/form-data; boundary=----WebKitFormBoundaryjzAIlHfLln4hwoYu',
    'referer': 'https://chatgptespanol.app/en/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
}

data = {
    '_wpnonce': '7552b39684',
    'post_id': '1610',
    'url': 'https://chatgptespanol.app/en',
    'action': 'wpaicg_chat_shortcode_message',
    'message': 'hi',
    'bot_id': '2387',
    'chatbot_identity': 'custom_bot_2387',
    'wpaicg_chat_client_id': '6jd3gjyBBi',
    'wpaicg_chat_history': '["Human: hi"]',
}

response = requests.post(url, headers=headers, data=data)

print(response.json())
