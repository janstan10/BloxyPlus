import httpx
from bs4 import BeautifulSoup
from pymongo import MongoClient
from time import sleep

def UnFormat(string):
    suffixes = {'K': 1000, 'M': 1000000, 'B': 1000000000, 'T': 1000000000000, 'Q': 1000000000000000}
    try:
        number = int(string)
    except ValueError:
        try:
            if string[-2].upper() in suffixes:
                number_str = string[:-2]
                suffix = string[-2:].upper()
            else:
                number_str = string[:-1]
                suffix = string[-1].upper()
            if suffix in suffixes:
                number = int(float(number_str) * suffixes[suffix])
            else:
                return 0
        except ValueError:
            return 0
    return number

Cluster = MongoClient(["mongodb+srv://DuxV2:4sC18ojT0i8ozFbv@99flip.bf5weme.mongodb.net/?retryWrites=true&w=majority"])
Database = Cluster["BloxyPlus"]
Data = Database["Values_Cosmic"]

AllData = Data.find()

ItemsNotChanged = 0
ItemsChanged = 0
ItemsAdded = 0
ItemsTotal = 0

Response = httpx.get("https://petsimulatorvalues.com/ps99.php?category=huges").text
#Response = httpx.get("https://petsimulatorvalues.com/ps99.php?category=titanics").text
Soup = BeautifulSoup(Response, 'html5lib')

Items = Soup.select("body > section.md-content.pb-5 > div > div.cards-groups.justify-content-around.content-scroll > a")

for Item in Items:
    ItemName = Item.select_one('.item-name').get_text(strip=True)
    ImageURL = Item.select_one('.imageBox img')['src']
    Value = UnFormat(Item.select_one('.float-right.pt-2').get_text(strip=True))/1000

    Check = next((item for item in AllData if item['name'] == ItemName), None)

    if Check:
        if Check["value"] != Value:
            Data.update_one({"name": ItemName}, {"$set": {"value": Value}})
            print(f"ITEM CHANGED | {ItemName}'s value changed from {Check['value']} to {Value}")
            ItemsChanged += 1
            ItemsTotal += 1
        else:
            ItemsNotChanged += 1
            ItemsTotal += 1
        sleep(0.01)
    else:
        Data.insert_one({
            "name": ItemName,
            "image_url": ImageURL,
            "value": Value
        })
        print(f"ITEM ADDED | {ItemName}'s was added with value {Value}")
        ItemsAdded += 1
        ItemsTotal += 1
        sleep(0.01)

print(f"Not Changed Items: {ItemsNotChanged}")
print(f"Changed Items: {ItemsChanged}")
print(f"Added Items: {ItemsAdded}")
print(f"Total Items: {ItemsTotal}")