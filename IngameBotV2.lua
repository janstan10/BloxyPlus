--// Configuration
local website = "https://beta.bloxyplus.com"
local auth = "c925b07c7bdc068b4c602c618e51308d"

--// Variables
local players            = game:GetService("Players")
local replicatedStorage  = game:GetService("ReplicatedStorage")
local httpService        = game:GetService("HttpService")
local virtualUser        = game:GetService("VirtualUser")
local textChatService    = game:GetService("TextChatService")

local localPlayer        = players.LocalPlayer
local playerGUI          = localPlayer:WaitForChild("PlayerGui")
local tradingWindow      = playerGUI:WaitForChild("TradeWindow")
local tradingMessage     = playerGUI:WaitForChild("Message")
local tradingStatus      = tradingWindow:WaitForChild("Frame"):WaitForChild("PlayerItems"):WaitForChild("Status")
local tradingMessages    = tradingWindow:WaitForChild("Frame"):WaitForChild("ChatOverlay"):WaitForChild("Messages")

local library            = replicatedStorage:WaitForChild("Library")
local saveModule         = require(library:WaitForChild("Client"):WaitForChild("Save"))
local tradingCommands    = require(library:WaitForChild("Client"):WaitForChild("TradingCmds"))
local tradingItems       = {}

local tradeId            = 0
local startTick          = tick()

local tradeUser          = nil
local goNext             = true

--// Initializing
print("[BloxyPlus Trade Bot] initializing variables...")

local request = request or http_request or http.request
local websocket = websocket or WebSocket
local getHwid = getuseridentifier or get_user_identifier or gethwid or get_hwid

--// Functions
print("[BloxyPlus Trade Bot] initializing functions...")

-- Gets the user's pets in their inventory
local function getHugesTitanics(hugesTitanicsIds)
	local hugesTitanics = {}
	
	for uuid, pet in next, saveModule.Get().Inventory.Pet do
		if table.find(hugesTitanicsIds, pet.id) then
			table.insert(hugesTitanics, {
                ["uuid"]   = uuid,
                ["id"]     = pet.id,
                ["type"]   = (pet.pt == 1 and "Golden") or (pet.pt == 2 and "Rainbow") or "Normal",
                ["shiny"]  = pet.sh or false
            })
		end
	end
	
	return hugesTitanics
end

-- Gets the user's diamonds
local function getDiamonds()
	for currencyUid, currency in next, saveModule.Get().Inventory.Currency do
		if currency.id == "Diamonds" then
			return currency._am, currencyUid
		end
	end
	
	return 0
end

-- Gets all new trade requests
local function getTrades()
	local trades          = {}
	local functionTrades  = tradingCommands.GetAllRequests()
	
	for player, trade in next, functionTrades do
		if trade[localPlayer] then
			table.insert(trades, player)
		end
	end
	
	return trades
end
-- Returns 0 if your not in a trade
local function getTradeId()
	return (tradingCommands.GetState() and tradingCommands.GetState()._id) or 0
end
-- Accept trade request
local function acceptTradeRequest(player)
	return tradingCommands.Request(player)
end
-- Reject trade request
local function rejectTradeRequest(player)
	return tradingCommands.Reject(player)
end
-- Readys the actual trade
local function readyTrade()
	return tradingCommands.SetReady(true)
end
-- Declines the actual trade
local function declineTrade()
	return tradingCommands.Decline()
end
-- Adds pet to trade
local function addPet(uuid)
	return tradingCommands.SetItem("Pet", uuid, 1)
end
-- Chat message (In Chat / PS99 Chat)
local oldMessages = {}
local function sendMessage(message)
	pcall(function()
		textChatService.TextChannels.RBXGeneral:SendAsync(message)
	end)
	pcall(function()
        task.wait(0.1)
		tradingCommands.Message(message)
	end)
    
    local function countMessages(message, oldMessages)
        local c = 0
        for i,v in next, oldMessages do
            if v == message then
                c = c + 1
            end
        end

        return c
    end

    if string.find(message, "accepted,") then
        print("Ins - mes")
        table.insert(oldMessages, "accepted")
    end
    if string.find(message, "Trade Declined") or string.find(message, "Trade declined") then
        print("Declined - mes")
        oldMessages = {}
    end
    if message == "Trade Completed!" then
        print("Completed - mes")
        oldMessages = {}
    end
    if countMessages("accepted", oldMessages) > 1 then
        oldMessages = {}
        sendMessage("Dupe attempt detected, declining trade")
        declineTrade()
    end
	
	return true
end
-- Gets name of pet through asset id
local function getName(assetIds, assetId)
	for index, petData in next, assetIds do
		if table.find(petData.assetIds, assetId) then
			return petData.name
		end
	end
	
	return "???"
end
-- Check for huges / titanics
local function checkItems(assetIds, goldAssetids, nameAssetIds)
	local items              = {}
	local itemTotal          = 0
	local onlyHugesTitanics  = true
	
	for index, item in next, tradingWindow.Frame.PlayerItems.Items:GetChildren() do
		if item.Name == "ItemSlot" then
			itemTotal = itemTotal + 1
			
			if not table.find(assetIds, item.Icon.Image) then
				onlyHugesTitanics = false
				break
			end
			
            local name    = getName(nameAssetIds, item.Icon.Image)
			local rarity  = (item.Icon:FindFirstChild("RainbowGradient") and "Rainbow") or (table.find(goldAssetids, item.Icon.Image) and "Golden") or "Normal"
			local shiny   = (item:FindFirstChild("ShinePulse") and true) or false

            local petstring = (shiny and "Shiny " or "")..((rarity == "Golden" and "Golden ") or (rarity == "Rainbow" and "Rainbow ") or "")..name
			
            table.insert(items, petstring)

            print(name, rarity, shiny)
		end 
	end
	
	if itemTotal == 0 then
		return true, "Please Deposit Pets"
	elseif not onlyHugesTitanics then
		return true, "Please Deposit Only Huges / Titanics"
	else
		return false, items
	end
end

--// Misc Scripts
print("[BloxyPlus Trade Bot] initializing misc features...")

localPlayer.Idled:Connect(function()
    virtualUser:Button2Down(Vector2.new(0,0),workspace.CurrentCamera.CFrame)
    task.wait(1)
    virtualUser:Button2Up(Vector2.new(0,0),workspace.CurrentCamera.CFrame)
end)

--// Huges / Titanic detection
print("[BloxyPlus Trade Bot] initializing detections...")

local assetIds          = {}
local goldAssetids      = {}
local nameAssetIds      = {}
local hugesTitanicsIds  = {}
-- Huges
for index, pet in next, replicatedStorage.__DIRECTORY.Pets.Huge:GetChildren() do
	local petData = require(pet)
	table.insert(assetIds, petData.thumbnail)
	table.insert(assetIds, petData.goldenThumbnail)
	table.insert(goldAssetids, petData.goldenThumbnail)
	table.insert(nameAssetIds, {
		["name"]      = petData.name,
		["assetIds"]  = {
			petData.thumbnail,
			petData.goldenThumbnail
		}
	})
	table.insert(hugesTitanicsIds, petData._id)
end
-- Titanics
for index, pet in next, replicatedStorage.__DIRECTORY.Pets.Titanic:GetChildren() do
	local petData = require(pet)
	table.insert(assetIds, petData.thumbnail)
	table.insert(assetIds, petData.goldenThumbnail)
	table.insert(goldAssetids, petData.goldenThumbnail)
	table.insert(nameAssetIds, {
		["name"]      = petData.name,
		["assetIds"]  = {
            petData.thumbnail,
			petData.goldenThumbnail
		}
	})
	table.insert(hugesTitanicsIds, petData._id)
end

--// Trade ID setting
spawn(function()
	while task.wait(1) do
		tradeId = getTradeId()
	end
end)

--// Connection Functions
print("[BloxyPlus Trade Bot] initializing connects...")

-- Detect accept / declining of the trade
local function connectMessage(localId, method, tradingItemsFunc)
	local messageConnection
	messageConnection = tradingMessage:GetPropertyChangedSignal("Enabled"):Connect(function()
        print(tradingMessage.Enabled)
		if tradingMessage.Enabled then
			local text = tradingMessage.Frame.Contents.Desc.Text
			
			if text == "✅ Trade successfully completed!" then -- Accepted the trade
				sendMessage("Trade Completed!")
                print(method)
                if method == "deposit" then
                    
                    print("DEPOSIT")
                    print(tradeUser)
                    print(securityKey)
                    for i,v in next, tradingItems do
                        print(i,v)
                    end

                    request({
                        Url = website.."/api/transactions/confirm_deposit",
                        Method = "POST",
                        Body = httpService:JSONEncode({
                            ["username"] = tradeUser,
                            ["pets"] = tradingItems
                        }),
                        Headers = {
                            ["Content-Type"] = "application/json",
                            ["Authorization"] = auth
                        }
                    })

                    messageConnection:Disconnect()
                    print("MESSAGE DISCONNECTION", localId, tradeId, tradeUser, 5)
                    task.wait(1)
                    tradingMessage.Enabled = false
                    goNext = true
                else
                    print("withdraw :)")

                    print(tradeUser)

                    print("CONFIRM PARTIAL WITHDRAW")
                    print(tradeUser)
                    print(securityKey)
                    for i,v in next, tradingItemsFunc do
                        print(i,v)
                    end

                    request({
                        Url = website.."/api/transactions/confirm_withdraw",
                        Method = "POST",
                        Body = httpService:JSONEncode({
                            ["username"] = tradeUser,
                            ["pets"] = tradingItems
                        }),
                        Headers = {
                            ["Content-Type"] = "application/json",
                            ["Authorization"] = auth
                        }
                    })
                end

                print("MESSAGE DISCONNECTION", localId, tradeId, tradeUser, 4)
				messageConnection:Disconnect()
				
				task.wait(1)
				tradingMessage.Enabled = false
                goNext = true
			elseif (string.find(text, " cancelled the trade!")) then -- Declined the trade
				sendMessage("Trade Declined")
                print("MESSAGE DISCONNECTION", localId, tradeId, tradeUser, 3)
				messageConnection:Disconnect()
				
				task.wait(1)
				tradingMessage.Enabled = false
                goNext = true
            elseif string.find(text, "left the game") then
                sendMessage("Trade Declined")
                print("MESSAGE DISCONNECTION", localId, tradeId, tradeUser, 2)
                messageConnection:Disconnect()
				
				task.wait(1)
				tradingMessage.Enabled = false
                goNext = true
			end
		else
            print("MESSAGE DISCONNECTION", localId, tradeId, tradeUser, 1)
            goNext = true
			messageConnection:Disconnect()
		end
	end)
end
-- Detect when user accepts, make various checks, and accepts the trade
local function connectStatus(localId, method)
	local statusConnection
	statusConnection = tradingStatus:GetPropertyChangedSignal("Visible"):Connect(function()
		if tradeId == localId then
			if tradingStatus.Visible then
				if method == "deposit" then
                    local error, output = checkItems(assetIds, goldAssetids, nameAssetIds)
				
                    if error then
                        sendMessage(output)
                    elseif localPlayer.PlayerGui.TradeWindow.Frame.PlayerDiamonds.TextLabel.Text ~= "0" then
                        sendMessage("Please don't add diamonds while depositing!")
                    elseif tradingStatus.Visible then
                        readyTrade()
                        tradingItems = output
                    end
                else
                    local error, output = checkItems(assetIds, goldAssetids, nameAssetIds)
                    if not error then
                        sendMessage("Please don't add pets while withdrawing!")
                    elseif localPlayer.PlayerGui.TradeWindow.Frame.PlayerDiamonds.TextLabel.Text ~= "0" then
                        sendMessage("Please don't add diamonds while depositing!")
                    else
                        readyTrade()
                    end
                end
			end
		else
			statusConnection:Disconnect()
		end
	end)
end

--// Main Script
print("[BloxyPlus Trade Bot] initializing main script...")

spawn(function()
	while task.wait(1) do
		local incomingTrades = getTrades()
		
		if #incomingTrades > 0 and goNext then
			local trade        = incomingTrades[1]
			local username     = trade.Name
            tradeUser          = players:GetUserIdFromNameAsync(username)
            print(username, tradeUser)

            local response = httpService:JSONDecode(request({
                Url = website .. "/api/transactions/get_method",
                Method = "POST",
                Body = httpService:JSONEncode({
                    ["username"] = tradeUser
                }),
                Headers = {
                    ["Authorization"] = auth,
                    ["Content-Type"] = "application/json"
                }
            }).Body)
			
            if response["method"] == "Not Registered" then
                sendMessage("Please register before depositing, " .. username)
                pcall(function()
					rejectTradeRequest(trade)
				end)
            else
                local accepted = acceptTradeRequest(trade)
                    
                if not accepted then
                    pcall(function()
                        rejectTradeRequest(trade)
                    end)
                end

                local localId  = getTradeId()
                tradeId        = localId

                if response["method"] == "Withdraw" then -- Withdraw
                    local withdrawData  = response["pets"]
                    local newWithdrawData = {}
                    local petInventory  = getHugesTitanics(hugesTitanicsIds)
                    local usedPets      = {}
                    local usedPetsNames = {}
                    local usedPetsNamesTemp = {}
                    tradingItems        = {}

                    sendMessage("Trade with: " .. username .. " accepted, Method: Withdraw")

                    -- 60 Second max
                    spawn(function() 
                        task.wait(60)
                        if tradeId == localId then
                            sendMessage("Trade declined, User timed out")
                            declineTrade()
                        end
                    end)

                    local function countPets(tbl, id, type, shiny)
                        local c = 0
                        for i,v in next, tbl do
                            if (v.id == id) and (v.type == type) and (v.shiny == shiny) then
                                c = c + 1
                            end
                        end

                        return c
                    end

                    for i, v in pairs(withdrawData) do
                        local newname = v
                        local data = {
                            ["game_name"] = newname,
                            ["id"] = newname,
                            ["type"] = "Normal",
                            ["shiny"] = false
                        }

                        if string.find(newname, "Shiny") then
                            newname = string.gsub(newname, "Shiny ", "")
                            data["shiny"] = true
                        end

                        if string.find(newname, "Golden") then
                            newname = string.gsub(newname, "Golden ", "")
                            data["type"] = "Golden"
                        elseif string.find(newname, "Rainbow") then
                            newname = string.gsub(newname, "Rainbow ", "")
                            data["type"] = "Rainbow"
                        end

                        data["game_name"] = newname
                        data["id"] = newname

                        table.insert(newWithdrawData, data)
                    end

                    for index, pet in next, newWithdrawData do
                        usedPetsNames[(tostring(pet.shiny) .. pet.type .. pet.id)] = countPets(newWithdrawData, pet.id, pet.type, pet.shiny)
                    end

                    for index, pet in next, newWithdrawData do
                        for index, petData in next, petInventory do
                            if not table.find(usedPets, petData.uuid) and (pet.id == petData.id) and (pet.shiny == petData.shiny) and (pet.type == petData.type) and not (usedPetsNames[(tostring(pet.shiny) .. pet.type .. pet.id)] == usedPetsNamesTemp[(tostring(pet.shiny) .. pet.type .. pet.id)]) then
                                if not usedPetsNamesTemp[(tostring(pet.shiny) .. pet.type .. pet.id)] then
                                    usedPetsNamesTemp[(tostring(pet.shiny) .. pet.type .. pet.id)] = 1
                                elseif usedPetsNamesTemp[(tostring(pet.shiny) .. pet.type .. pet.id)] ~= usedPetsNames[(tostring(pet.shiny) .. pet.type .. pet.id)] then
                                    usedPetsNamesTemp[(tostring(pet.shiny) .. pet.type .. pet.id)] = usedPetsNamesTemp[(tostring(pet.shiny) .. pet.type .. pet.id)] + 1
                                end
                                
                                table.insert(usedPets, petData.uuid)

                                local petstring = (petData.shiny and "Shiny " or "")..((petData.type == "Golden" and "Golden ") or (petData.type == "Rainbow" and "Rainbow ") or "")..petData.id
                                table.insert(tradingItems, petstring)

                                addPet(petData.uuid)
                                break
                            end
                        end
                    end

                    if not #tradingItems == 0 then
                        sendMessage("Missing stock, join another bot to receive your pets!")
                        declineTrade()
                    elseif #tradingItems ~= #withdrawData then
                        sendMessage("Missing stock, join another bot to receive your pets!")
                        connectMessage(localId, "withdraw", tradingItems)
                        connectStatus(localId, "withdraw")
                        goNext = false
                    elseif #tradingItems == #withdrawData then
                        sendMessage("Please accept to receive your pets!")
                        connectMessage(localId, "withdraw", tradingItems)
                        connectStatus(localId, "withdraw")
                        goNext = false
                    end
                else -- Deposit
                    tradingItems  = {}

                    sendMessage("Trade with: " .. username .. " accepted, Method: Deposit")

                    -- 60 Second max
                    spawn(function() 
                        task.wait(60)
                        if tradeId == localId then
                            sendMessage("Trade declined, User timed out")
                            declineTrade()
                        end
                    end)

                    connectMessage(localId, "deposit", {})
                    connectStatus(localId, "deposit")
                    goNext = false
                end
            end
		end
	end
end)

print("[BloxyPlus Trade Bot] script loaded in " .. tostring(tick() - startTick) .. "s")