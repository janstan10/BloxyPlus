from pymongo import MongoClient
import secrets

cluster = MongoClient("mongodb+srv://DuxV2:4sC18ojT0i8ozFbv@99flip.bf5weme.mongodb.net/?retryWrites=true&w=majority")
database = cluster["BloxyPlus"]
users = database["Users"]

name = "DuxIsDecaying"

user_doc = users.find_one({"username": name})
if user_doc:
    inv = user_doc["inventory"]
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    inv.append({"name": "Huge Leprechaun Cat", "uid": secrets.token_hex(nbytes=16)})
    users.update_one({"username": name}, {"$set": {"inventory": inv}})
    print("Inventory updated successfully.")
else:
    print("User not found.")
