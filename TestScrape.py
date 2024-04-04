import httpx

RAPValues = httpx.get("https://biggamesapi.io/api/collection/Pets").json()
def GetData(PetName):
    CheckName = str.lower(PetName)
    FoundPet = False

    Golden = False
    Rainbow = False
    Shiny = False

    if "golden " in CheckName:
        CheckName = CheckName.replace("golden ", "", 1)
        Golden = True

    if "rainbow " in CheckName:
        CheckName = CheckName.replace("rainbow ", "", 1)
        Rainbow = True

    if "shiny" in CheckName:
        CheckName = CheckName.replace("shiny ", "", 1)
        Shiny = True

    for Pet in RAPValues["data"]:
        FoundName = str.lower(Pet["configData"]["name"])

        if CheckName == FoundName:
            if Golden:
                ImageURL = Pet["configData"]["goldenThumbnail"]
            else:
                ImageURL = Pet["configData"]["thumbnail"]

            FoundPet = {"name": Pet["configData"]["name"], "icon": ImageURL}
            break
    
    if FoundPet:
        FoundPet["icon"] = FoundPet["icon"].replace("rbxassetid://", "", 1)
        FoundPet["icon"] = "https://biggamesapi.io/image/" + FoundPet

    return FoundPet

print(GetData("SHINY GOLDEN HUGE HAPPY ROCK"))
