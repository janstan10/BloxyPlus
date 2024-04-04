from pymongo import MongoClient
import secrets

cluster = MongoClient("mongodb+srv://DuxV2:4sC18ojT0i8ozFbv@99flip.bf5weme.mongodb.net/?retryWrites=true&w=majority")
database = cluster["BloxyPlus"]
users = database["Users"]

name = "DuxIsDecaying"

user_doc = users.find_one({"username": name})
if user_doc:
    inv = []
    inv.append({"name": "Huge Happy Computer", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Crocodile", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Storm Agony", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Wildfire Agony", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Anime Unicorn", "uid": secrets.token_hex(nbytes=16)})
    users.update_one({"username": name}, {"$set": {"inventory": inv}})
    print("Inventory updated successfully.")
else:
    print("User not found.")
