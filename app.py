import csv
import time
import json
import random
import asyncio
import threading
import secrets
import requests
from pymongo import MongoClient
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Flask, render_template, jsonify, request, make_response, redirect, render_template_string, send_file
from flask_jwt_extended import JWTManager, create_access_token, decode_token
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_socketio import SocketIO
from io import BytesIO, StringIO
from functools import wraps

locks = {}

cluster = MongoClient(["mongodb+srv://DuxV2:4sC18ojT0i8ozFbv@99flip.bf5weme.mongodb.net/?retryWrites=true&w=majority"])
database = cluster["BloxyPlus"]
users = database["Users"]
values = database["Values_Cosmic"]
games = database["Games"]
giveaways = database["Giveaways"]
withdraws = database["Withdraws"]

app = Flask(
    import_name=__name__,
    template_folder="./web/pages",
    static_folder="./web/static",
    static_url_path="/static",
)

app.config['JWT_SECRET_KEY'] = 'your_secret_key'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=3650)
jwt = JWTManager(app)
#socketio = SocketIO(app)
socketio = SocketIO(app, async_mode='gevent')
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100000 per hour"],
    storage_uri="memory://",
)

connected_clients = 56

logincodes = {}
messages = []
last_message_time = {}

def format(value):
    suffixes = ["", "K", "M", "B", "T"]
    suffix_index = 0

    while value >= 1000 and suffix_index < len(suffixes) - 1:
        value /= 1000
        suffix_index += 1

    return f"{value:.1f}{suffixes[suffix_index]}"

async def run_giveaway(data):
    id = data["id"]
    time = data["time"]
    thumbnail = data["thumbnail"]
    value = data["value"]
    
    if time <= 0:
        socketio.emit('giveaway_ended', {"thumbnail": thumbnail, "value": value, "time": 0}, namespace='/site')
        return  # End the function if time is already 0

    while time > 0:
        time = time - 1
        giveaways.update_one({"id": id}, {"$set": {"time": time}})
        socketio.emit('giveaway_updated', {"thumbnail": thumbnail, "value": value, "time": time}, namespace='/site')
        await asyncio.sleep(1)

    giveaways.delete_one({"id": id}, {"$set": {"time": time}})
    socketio.emit('giveaway_ended', {"thumbnail": thumbnail, "value": value, "time": 0}, namespace='/site')

def async_run_giveaway(data):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(run_giveaway(data))

def remove_duplicate_pets():
    collection = users
    uid_counts = {}

    for user in collection.find():
        inventory = user.get('inventory', [])
        
        for pet in inventory:
            uid = pet.get('uid')
            uid_counts[uid] = uid_counts.get(uid, 0) + 1

    removed_count = 0

    for user in collection.find():
        inventory = user.get('inventory', [])
        updated_inventory = [pet for pet in inventory if uid_counts[pet.get('uid')] == 1]
        
        has_duplicates = any(uid_counts[pet.get('uid')] > 1 for pet in inventory)
        
        if has_duplicates:
            collection.update_one(
                {'_id': user['_id']},
                {'$set': {'banned': "Duping"}}
            )
        
        removed_count += len(inventory) - len(updated_inventory)
        
        collection.update_one(
            {'_id': user['_id']},
            {'$set': {'inventory': updated_inventory}}
        )

def check_chat_cooldown(identity):
    cooldown_time = timedelta(seconds=5)
    last_time = last_message_time.get(identity)
    
    if last_time and datetime.utcnow() - last_time < cooldown_time:
        return False
    
    last_message_time[identity] = datetime.utcnow()
    return True

def apply_chat_filter(message):
    return True

def check_if_logged_in(request):
    if not bool(request.cookies.get("access_token_cookie")):
        return False
    
    if not users.find_one({"id": decode_token(request.cookies.get("access_token_cookie"))["sub"]}):
        return False
    
    return True

def get_icon(name):
    if data := values.find_one({"name": str.upper(name)}):
        return data["image_url"]
    else:
        return ""

def get_value(name):
    if data := values.find_one({"name": str.upper(name)}):
        return data["value"]
    else:
        return 0

def transaction_lock(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        user_id = decode_token(request.cookies.get("access_token_cookie"))['sub']
        if user_id not in locks:
            locks[user_id] = threading.Lock()

        with locks[user_id]:
            return func(*args, **kwargs)
    return wrapper

@socketio.on('connect', namespace='/games')
def handle_games_connect():
    print("Connected to Games")

@socketio.on('connect', namespace='/site')
def handle_site_connect():
    global connected_clients

    print("Connected to Site")
    connected_clients += 1
    socketio.emit("users_added", {"users": connected_clients}, namespace="/site")

@socketio.on('disconnect', namespace='/site')
def handle_site_disconnect():
    global connected_clients
    
    print("Connected to Site")
    connected_clients -= 1
    socketio.emit("users_added", {"users": connected_clients}, namespace="/site")

@app.errorhandler(404)
def not_found_error(error):
    return redirect("/")

@app.route("/r/<userid>")
def user_profile(userid):
    return redirect("/")

@app.route("/socket/test")
def test_socket():
    socketio.emit('giveaway_created', {"thumbnail": "test", "value": 100000, "time": 60}, namespace='/site')
    return redirect("/")

@app.route("/socket/test2")
def test_socket2():
    socketio.emit('giveaway_updated', {"thumbnail": "test", "value": 100000, "time": 50}, namespace='/site')
    return redirect("/")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/coinflip")
def coinflip():
    return render_template("coinflip.html")

@app.route("/tos")
@app.route("/terms")
def tos():
    return render_template("tos.html")

@app.route('/image')
def get_image():
    image_url = request.args.get('url')
    response = requests.get(image_url)

    if response.status_code == 200:
        content_type = response.headers.get('Content-Type', 'image/png')
        image_data = BytesIO(response.content)
        return send_file(image_data, mimetype=content_type)
    
    content_type = 'image/png'
    return send_file("web/static/img/errorloading.png", mimetype=content_type)

@app.route("/api/affiliates/get", methods=["GET"])
def get_affiliates():
    if not check_if_logged_in(request):
        return jsonify(error=False, message="User not logged in"), 400
    
    decoded_token = decode_token(request.cookies.get("access_token_cookie"))
    identity = decoded_token['sub']

    res = users.find_one({"id": identity})
    if res:
        return jsonify(error=False, code="https://bloxyplus.com/r/" + str(res["id"]))
    else:
        return jsonify(error=True, message="Internal Server Error"), 500

@app.route("/api/leaderboard/get", methods=["GET"])
def get_leaderboard():
    leaderboard = []

    for user in users.find():
        profit = 0
        value = 0
        inventory = user["inventory"]

        for pet in inventory:
            value += get_value(pet["name"])

        profit = (user["stats"]["withdrawn"] + value) - user["stats"]["deposited"]

        leaderboard.append({"name": user["username"], "thumbnail": user["thumbnail"], "profit": profit})

    leaderboard = sorted(leaderboard, key=lambda x: x["profit"], reverse=True)
    top_10_leaderboard = leaderboard[:10]

    formatted_leaderboard = []
    
    for i, entry in enumerate(top_10_leaderboard):
        formatted_leaderboard.append({"name": entry['name'], "thumbnail": entry['thumbnail'], "profit": entry['profit']})

    return jsonify(error=False, leaderboard=formatted_leaderboard)

@app.route("/api/user/get", methods=["GET"])
def get_user():
    if not check_if_logged_in(request):
        return jsonify(error=False, message="User not logged in"), 400
    
    decoded_token = decode_token(request.cookies.get("access_token_cookie"))
    identity = decoded_token['sub']
        
    res = users.find_one({"id": identity})
    if res:
        userdata = {}
        balance = 0

        for pet in res["inventory"]:
            balance += get_value(pet["name"])

        userdata["userid"] = identity
        userdata["username"] = res["username"]
        userdata["balance_int"] = balance
        userdata["balance_str"] = format(balance)
        userdata["inventory"]  = res["inventory"]
        userdata["thumbnail"] = res["thumbnail"]
        userdata["whitelisted"] = res["whitelisted"]

        return jsonify(error=False, data=userdata), 200
    else:
        return jsonify(error=True, message="Internal Server Error"), 500

@app.route("/api/transactions/get_method", methods=["POST"])
def get_method():
    if not request.headers.get('Authorization') or request.headers.get('Authorization') != "c925b07c7bdc068b4c602c618e51308d":
        return jsonify(error=True, message="Unauthorized"), 401
    
    json_data = request.get_json()
    username = json_data.get("username")

    if not username:
        return jsonify(error=True, message="Please enter a valid username"), 400
    
    if not users.find_one({"id": username}):
        return jsonify(error=False, method="Not Registered"), 200
    
    if withdraws.find_one({"id": username}):
        newpets = []
        for i in withdraws.find_one({"id": username})["pets"]:
            newpets.append(i["name"])

        print(newpets)
        return jsonify(error=False, method="Withdraw", pets=newpets), 200
    else:
        return jsonify(error=False, method="Deposit"), 200
    
@app.route("/api/transactions/confirm_deposit", methods=["POST"])
def confirm_deposit():
    if not request.headers.get('Authorization') or request.headers.get('Authorization') != "c925b07c7bdc068b4c602c618e51308d":
        return jsonify(error=True, message="Unauthorized"), 401
    
    json_data = request.get_json()
    username = json_data.get("username")
    pets = json_data.get("pets")
    newpets = []

    if not username:
        return jsonify(error=True, message="Please enter a valid username"), 400
    
    if not pets:
        return jsonify(error=True, message="Please add pets"), 400
    
    if not users.find_one({"id": username}):
        return jsonify(error=True, method="Not Registered"), 400
    
    for pet in pets:
        users.update_one({"id": username}, {"$inc": {"stats.deposited": get_value(pet)}})
        newpets.append({"name": pet, "uid": secrets.token_hex(nbytes=16)})
    
    user_obj = users.find_one({"id": username})
    user_inventory = user_obj["inventory"]
    user_inventory.extend(newpets)
    users.update_one({"id": username}, {"$set": {"inventory": user_inventory}})
    return jsonify(error=False, message="Successfully Deposited"), 200

@app.route("/api/transactions/confirm_withdraw", methods=["POST"])
def confirm_withdraw():
    if not request.headers.get('Authorization') or request.headers.get('Authorization') != "c925b07c7bdc068b4c602c618e51308d":
        return jsonify(error=True, message="Unauthorized"), 401
    
    json_data = request.get_json()
    username = json_data.get("username")
    pets = json_data.get("pets")

    print(username)
    
    if not users.find_one({"id": username}):
        return jsonify(error=True, method="Not Registered"), 400
    
    withdrawdata = withdraws.find_one({"id": username})
    
    if len(withdrawdata['pets']) == len(pets):
        withdraws.delete_one({"id": username})
    else:
        print(pets)
        withdraws.update_one({"id": username}, {"$pull": {"pets": {"name": {"$in": pets}}}})

    return jsonify(error=False, message="Successfully Withdrew"), 200

@app.route("/api/chat/get")
def get_messages():
    return jsonify(messages=messages), 200

@app.route("/api/chat/send", methods=["POST"])
@limiter.limit("100 per minute")
def send_message():
    if not check_if_logged_in(request):
        return jsonify(error=True, message="You are not logged in"), 400
    
    json_data = request.get_json()
    message = json_data.get("message")

    if not message or not message.strip():
        return jsonify(error=True, message="Please enter a chat message"), 400
    
    decoded_token = decode_token(request.cookies.get("access_token_cookie"))
    identity = decoded_token['sub']
        
    if not check_chat_cooldown(identity):
        return jsonify(error=True, message="Chat cooldown, try again later"), 429

    if len(message) > 75:
        return jsonify(error=True, message="Message exceeds 75 characters limit"), 400

    if "<" in message:
        return jsonify(error=True, message="Nice try bud"), 400

    if not apply_chat_filter(message):
        return jsonify(error=True, message="Message contains inappropriate content"), 400

    res = users.find_one({"id": identity})
    if res:
        messagedict = {"username": res["username"], "thumbnail": res["thumbnail"], "message": message}
        messages.append(messagedict)
        socketio.emit("message_sent", messagedict, namespace="/site")
        return jsonify(message="Successfully sent message"), 200
    else:
        return jsonify(error=True, message="Internal Server Error"), 500

@app.route('/api/coinflip/get')
@limiter.limit("100 per minute")
def get_coinflip():
    send = {}
    allgames = []

    totaljoinable = 0
    totalgames = 0
    totalvalue = 0

    for i in games.find():
        data = i
        totalgames += 1
        totalvalue += data["value"]

        if data["winner"] == None:
            totaljoinable += 1

        allgames.append({'type': data['type'], 'winner': data["winner"], 'gid': str(data['gid']), 'value': data['value'], 'active': data['active'], 'heads': data['heads'], 'tails': data['tails']})

    send["error"] = False
    send["games"] = allgames
    send["stats"] = {"total_games": totalgames, "total_value": totalvalue, "total_joinable": totaljoinable}

    return jsonify(send), 200

@app.route('/api/coinflip/create', methods=['POST'])
@limiter.limit("100 per minute")
@transaction_lock
def create_coinflip():
    if not check_if_logged_in(request):
        return jsonify(error=True, message="You are not logged in"), 400

    user_id = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_id})

    if user_data and user_data.get("in_transaction"):
        return jsonify(error=True, message="You are already creating a game!"), 400

    users.update_one({"id": user_id}, {"$set": {"in_transaction": True}})

    json_data = request.get_json()
    items_to_bet = json_data.get("items")
    choice = json_data.get("choice")

    if not items_to_bet or not choice:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="Invalid Arguments"), 400
    
    if len(items_to_bet) == 0:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You must bet at least 1 item!"), 400
    
    user_identity = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_identity})
    
    if user_data:
        total_value = 0
        new_inventory = []

        for inventory_item in user_data["inventory"]:
            if inventory_item["uid"] in [item["uid"] for item in items_to_bet]:
                total_value += get_value(inventory_item["name"])
            else:
                new_inventory.append(inventory_item)

        if len(new_inventory) != len(user_data["inventory"]) - len(items_to_bet):
            users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
            return jsonify(error=True, message="You dont own those item(s)"), 400
        else:
            game_id = secrets.token_hex(nbytes=16)

            for pet in items_to_bet:
                pet["thumbnail"] = get_icon(pet["name"])

            game_data = {
                "type": "Coinflip",
                "gid": game_id,
                "value": total_value,
                "winner": None,
                "active": True,
                "heads": {
                    "username": user_data["username"],
                    "thumbnail": user_data["thumbnail"],
                    "userid": user_identity,
                    "pets": items_to_bet
                },
                "tails": {
                    "username": None,
                    "thumbnail": None,
                    "userid": None,
                    "pets": []
                }
            }

            if choice == "tails":
                game_data["heads"] = {
                    "username": None,
                    "thumbnail": None,
                    "userid": None,
                    "pets": []
                }

                game_data["tails"] = {
                    "username": user_data["username"],
                    "thumbnail": user_data["thumbnail"],
                    "userid": user_identity,
                    "pets": items_to_bet
                }

            games.insert_one(game_data)
            totaljoinable = 0
            totalgames = 0
            totalvalue = 0

            for i in games.find():
                data = i
                totalgames += 1
                totalvalue += data["value"]

                if data["winner"] == None:
                    totaljoinable += 1

            users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
            users.update_one({"id": user_identity}, {"$set": {"inventory": new_inventory}})
            socketio.emit('game_created', {'stats': {"total_games": totalgames, "total_value": totalvalue, "total_joinable": totaljoinable}, 'type': game_data['type'], 'winner': game_data["winner"], 'gid': str(game_data['gid']), 'value': game_data['value'], 'active': game_data['active'], 'heads': game_data['heads'], 'tails': game_data['tails']}, namespace='/games')
            thread = threading.Thread(target=remove_duplicate_pets)
            thread.start()
            return jsonify(error=False, message="Successfully Created Game"), 200
    else:
        return jsonify(error=True, message="We encountered an error grabbing your data, please try again later"), 400

@app.route('/api/coinflip/join', methods=['POST'])
@limiter.limit("100 per minute")
@transaction_lock
def join_coinflip():
    if not check_if_logged_in(request):
        return jsonify(error=True, message="You are not logged in"), 400

    user_id = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_id})

    users.update_one({"id": user_id}, {"$set": {"in_transaction": True}})

    if user_data and user_data.get("in_transaction"):
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You are already joining a game!"), 400
    
    json_data = request.get_json()
    game_id = json_data.get("gid")
    selected_items = json_data.get("items")

    if not selected_items or not game_id:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You must select at least 1 item and provide a game ID!"), 400
    
    if len(selected_items) == 0:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You must bet at least 1 item!"), 400
    
    user_identity = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_identity})
    game = games.find_one({"gid": game_id})

    if not user_data or not game:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="We encountered an error grabbing data, please try again later"), 400
    
    if game["active"] == False:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="The game has already ended!"), 400
    
    if game["heads"]["userid"] == user_identity or game["tails"]["userid"] == user_identity:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You can't join your own game!"), 400
    
    user_inventory_ids = []
    selected_item_ids = []
    found_ids = []

    for pet in user_data["inventory"]:
        user_inventory_ids.append(pet["uid"])

    for pet in selected_items:
        selected_item_ids.append(pet["uid"])

    for uid in user_inventory_ids:
        if uid in selected_item_ids:
            found_ids.append(uid)

    if len(found_ids) != len(selected_item_ids):
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You don't own those item(s)!"), 400
    
    for uid in found_ids:
        users.update_one({"id": user_id}, {"$pull": {"inventory": {"uid": uid}}})

    for pet in selected_items:
        pet["thumbnail"] = get_icon(pet["name"])

    chosen_side = None
    winner_side = "heads"
    side_data = {
        "username": user_data["username"],
        "userid": user_data["id"],
        "thumbnail": user_data["thumbnail"],
        "pets": selected_items
    }

    if game["heads"]["username"] is None:
        chosen_side = "heads"
    elif game["tails"]["username"] is None:
        chosen_side = "tails"

    if random.randint(0, 1) == 1:
        winner_side = "tails"

    games.update_one({"gid": game_id}, {"$set": {"winner": winner_side, "active": False, chosen_side: side_data}})
    time.sleep(0.5)
    game_data = games.find_one({"gid": game_id})

    winner_userid = game_data[winner_side]["userid"]

    for pet in game_data["heads"]["pets"]:
        users.update_one({"id": winner_userid}, {"$push": {"inventory": pet}})

    for pet in game_data["tails"]["pets"]:
        users.update_one({"id": winner_userid}, {"$push": {"inventory": pet}})

    # need to do taxes

    totaljoinable = 0
    totalgames = 0
    totalvalue = 0

    for i in games.find():
        data = i
        totalgames += 1
        totalvalue += data["value"]

        if data["winner"] is None:
            totaljoinable += 1

    socketio.emit('game_ended', {'stats': {"total_games": totalgames, "total_value": totalvalue, "total_joinable": totaljoinable}, 'type': game_data['type'], 'winner': game_data["winner"], 'gid': str(game_data['gid']), 'value': game_data['value'], 'active': game_data['active'], 'heads': game_data['heads'], 'tails': game_data['tails']}, namespace='/games')
    users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
    return jsonify(error=False, message="Successfully joined the game!"), 200

@app.route('/api/giveaway/get', methods=['GET'])
@limiter.limit("100 per minute")
@transaction_lock
def get_giveaway():
    if giveaway := giveaways.find_one({"id": "giveaway"}):
        return jsonify(giveaways=[{"thumbnail": giveaway["thumbnail"], "value": giveaway["value"], "time": giveaway["time"]}]), 200
    else:
        return jsonify(giveaways=[]), 200

@app.route('/api/giveaway/create', methods=['POST'])
@limiter.limit("100 per minute")
@transaction_lock
def create_giveaway():
    if not check_if_logged_in(request):
        return jsonify(error=True, message="You are not logged in"), 400

    user_id = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_id})

    if user_data and user_data.get("in_transaction"):
        return jsonify(error=True, message="You are already creating a game!"), 400

    users.update_one({"id": user_id}, {"$set": {"in_transaction": True}})

    json_data = request.get_json()
    items_to_bet = json_data.get("items")

    if not items_to_bet:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="Invalid Arguments"), 400
    
    if len(items_to_bet) != 1:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You can only giveaway 1 item at a time!"), 400
    
    if len(items_to_bet) == 0:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You must giveaway at least 1 item!"), 400
    
    user_identity = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_identity})
    
    if user_data:
        founditem = False

        for item2 in user_data["inventory"]:
            if item2["uid"] == items_to_bet[0]["uid"]:
                founditem = item2
                break
        
        if not founditem:
            users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
            return jsonify(error=True, message="You dont own those item(s)"), 400
        else:
            if giveaways.find_one({"id": "giveaway"}):
                users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
                return jsonify(error=True, message="There is already an active giveaway"), 400
            
            data = {
                "thumbnail": get_icon(founditem["name"]),
                "value": get_value(founditem["name"]),
                "time": 60,
                "id": "giveaway"
            }

            giveaways.insert_one(data)
            users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
            users.update_one({"id": user_id}, {"$pull": {"inventory": {"uid": founditem["uid"]}}})
            socketio.emit('giveaway_created', {"thumbnail": data["thumbnail"], "value": data["value"], "time": data["time"]}, namespace='/site')
            thread = threading.Thread(target=remove_duplicate_pets)
            thread.start()
            thread2 = threading.Thread(target=async_run_giveaway, args=(data,))
            thread2.start()

            return jsonify(error=False, message="Successfully Created Giveaway"), 200
    else:
        return jsonify(error=True, message="We encountered an error grabbing your data, please try again later"), 400

@app.route('/api/user/withdraw', methods=['POST'])
@limiter.limit("100 per minute")
@transaction_lock
def withdraw():
    if not check_if_logged_in(request):
        return jsonify(error=True, message="You are not logged in"), 400

    user_id = decode_token(request.cookies.get("access_token_cookie"))['sub']
    user_data = users.find_one({"id": user_id})

    if user_data["in_transaction"]:
        return jsonify(error=True, message="You are already in a transaction!"), 400

    users.update_one({"id": user_id}, {"$set": {"in_transaction": True}})

    json_data = request.get_json()
    items_to_withdraw = json_data.get("items")

    if not items_to_withdraw:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="Invalid Arguments"), 400

    if len(items_to_withdraw) == 0:
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You must withdraw at least 1 item!"), 400

    user_data = users.find_one({"id": user_id})

    if withdraws.find_one({"id": user_id}):
        users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
        return jsonify(error=True, message="You already have a Withdraw Pending!"), 400

    if user_data:
        total_value = 0
        new_inventory = []

        for inventory_item in user_data["inventory"]:
            matching_item = next((item for item in items_to_withdraw if item["uid"] == inventory_item["uid"]), None)
            if matching_item:
                total_value += values.find_one({"name": inventory_item["name"].upper()})["value"]
            else:
                new_inventory.append(inventory_item)

        if len(new_inventory) != len(user_data["inventory"]) - len(items_to_withdraw):
            users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
            return jsonify(error=True, message="You dont own those item(s)"), 400
        else:
            withdraw = {
                "id": user_data["id"],
                "username": user_data["username"],
                "pets": items_to_withdraw
            }

            for pet in items_to_withdraw:
                users.update_one({"id": user_id}, {"$inc": {"stats.withdrawn": get_value(pet["name"])}})

            withdraws.insert_one(withdraw)
            users.update_one({"id": user_id}, {"$set": {"in_transaction": False}})
            users.update_one({"id": user_id}, {"$set": {"inventory": new_inventory}})
            thread = threading.Thread(target=remove_duplicate_pets)
            thread.start()
            return jsonify(error=False, message="Successfully Created Withdraw"), 200
    else:
        return jsonify(error=True, message="We encountered an error grabbing your data, please try again later"), 400

@app.route("/api/user/inventory", methods=['GET'])
@limiter.limit("100 per minute")
def get_inventory():
    if not check_if_logged_in(request):
        return jsonify(error=True, message="You are not logged in"), 400
    
    identity = decode_token(request.cookies.get("access_token_cookie"))['sub']
    res = users.find_one({"id": identity})
    
    if res:
        newinventory = []
        inventory = res["inventory"]
        balance = 0
        items = 0

        for i in inventory:
            check = values.find_one({"name": i["name"].upper()})
            if check:
                item_data = {}
                item_data["name"] = i["name"]
                item_data["uid"] = i["uid"]
                item_data["value"] = check["value"]
                item_data["thumbnail"] = check["image_url"]
                balance += check["value"]
                items += 1

                newinventory.append(item_data)

        response_data = {"inventory": newinventory, "balance": balance, "items": items}
        return jsonify(error=False, data=response_data), 200
    else:
        return jsonify(error=True, message="We encountered an error grabbing your data, please try again later"), 400

@app.route("/api/login/get", methods=['POST'])
@limiter.limit("100 per minute")
def get_login_code():
    if check_if_logged_in(request):
        return jsonify(error=True, message="You are already logged in"), 400
    
    words = ["dog", "cat", "mouse", "plus", "horse", "house", "bird", "fish", "frog", "moon", "star", "fire"]
    phrase = ' '.join(map(str, random.sample(words, 8)))

    json = request.get_json()
    username = json.get("username")

    if not username:
        return jsonify(error=True, message="Invalid Arguments"), 400
    
    if username in logincodes:
        return jsonify(phrase=logincodes[username]), 200
    else:
        useridresponse = requests.post('https://users.roblox.com/v1/usernames/users', headers={'accept': 'application/json','Content-Type': 'application/json',}, json={"usernames": [username],"excludeBannedUsers": True})
        if useridresponse.status_code != 200:
            return jsonify(error=True, message="Internal Server Error"), 500

        if useridresponse.json()["data"] == []:
            return jsonify(error=True, message="Please enter a valid Roblox Username"), 200

        if useridresponse.status_code == 200:
            logincodes[username] = phrase
            return jsonify(phrase=phrase), 200
        else:
            return jsonify(error=True, message="Internal Server Error"), 500

@app.route("/api/login/check", methods=['POST'])
@limiter.limit("100 per minute")
def check_login_code():
    if check_if_logged_in(request):
        return jsonify(error=True, message="You are already logged in"), 400
    
    json = request.get_json()
    username = json.get("username")

    if not username:
        return jsonify(error=True, message="Invalid Arguments"), 400
    
    if not username in logincodes:
        return jsonify(error=True, message="You do not have an active login code"), 200

    useridresponse = requests.post('https://users.roblox.com/v1/usernames/users', headers={'accept': 'application/json','Content-Type': 'application/json',}, json={"usernames": [username],"excludeBannedUsers": True})
    if useridresponse.status_code != 200:
        return jsonify(error=True, message="Internal Server Error"), 500

    descriptionresponse = requests.get('https://users.roblox.com/v1/users/' + str(useridresponse.json()["data"][0]["id"]))
    if descriptionresponse.status_code != 200:
        return jsonify(error=True, message="Internal Server Error"), 500
    
    description = descriptionresponse.json()["description"]
    if description != logincodes[username]:
        return jsonify(error=True, message="Please set your Roblox description to the phrase")
    
    thumbnailresponse = requests.get('https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=' + str(useridresponse.json()["data"][0]["id"]) + '&size=180x180&format=Png')
    if thumbnailresponse.status_code != 200 or 'error' in thumbnailresponse.json():
        thumbnail = "https://tr.rbxcdn.com/30DAY-AvatarHeadshot-D3A785519FCDC2ABA02D23031B7586F2-Png/150/150/AvatarHeadshot/Png/noFilter"
    else:
        thumbnail = thumbnailresponse.json()["data"][0]["imageUrl"]

    res = users.find_one({"id": useridresponse.json()["data"][0]["id"]})
    if not res:
        users.insert_one({
            "id": useridresponse.json()["data"][0]["id"],
            "username": username,
            "thumbnail": thumbnail,
            "df": 1,
            "inventory": [],
            "stats": {
                "deposited": 0,
                "withdrawn": 0,
                "wagered": 0,
            },
            "affiliates": {
                "giveto": None,
                "recieved": 0,
                "recievefrom": [],
            },
            "banned": False,
            "whitelisted": False,
        })


    access_token = create_access_token(identity=useridresponse.json()["data"][0]["id"])
    responsemake = make_response(jsonify(emessage="Successfully Logged In"))
    responsemake.set_cookie("access_token_cookie", value=access_token, expires=datetime.utcnow() + timedelta(days=3650), httponly=True)
    return responsemake

@app.route("/logout")
def logout():
    if not check_if_logged_in(request):
        return redirect("/")

    response = make_response(redirect('/'))
    response.delete_cookie("access_token_cookie")
    return response

if __name__ == "__main__":
    #socketio.run(app, debug=True, host="0.0.0.0", port=8000)
    app.run(host="0.0.0.0", debug=True, port=8000)
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)