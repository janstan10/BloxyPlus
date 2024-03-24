from pymongo import MongoClient

client = MongoClient('mongodb+srv://DuxV2:4sC18ojT0i8ozFbv@99flip.bf5weme.mongodb.net/?retryWrites=true&w=majority')
db = client['BloxyPlus']
users_collection = db['Users']

uid_counts = {}

for user in users_collection.find():
    inventory = user.get('inventory', [])
    
    for pet in inventory:
        uid = pet.get('uid')
        uid_counts[uid] = uid_counts.get(uid, 0) + 1

removed_count = 0

for user in users_collection.find():
    inventory = user.get('inventory', [])
    updated_inventory = [pet for pet in inventory if uid_counts[pet.get('uid')] == 1]
    
    has_duplicates = any(uid_counts[pet.get('uid')] > 1 for pet in inventory)
    
    if has_duplicates:
        users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'banned': True}}
        )
    
    removed_count += len(inventory) - len(updated_inventory)
    
    users_collection.update_one(
        {'_id': user['_id']},
        {'$set': {'inventory': updated_inventory}}
    )

print(f"Number of duplicate pets removed: {removed_count}")

client.close()
