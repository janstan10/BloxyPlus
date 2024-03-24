print("[BP] Bot Loaded")

-- Variables
local website = "https://bloxyplus.com"
local auth = "c925b07c7bdc068b4c602c618e51308d"
local request = http_request or request or HttpPost or syn.request

local players = game:GetService("Players")
local replicatedStorage = game:GetService("ReplicatedStorage")
local textChatService = game:GetService("TextChatService")
local virtualUser = game:GetService("VirtualUser")
local runService = game:GetService("RunService")
local httpService = game:GetService("HttpService")

local library = replicatedStorage:WaitForChild("Library")
local lib = require(replicatedStorage:WaitForChild("Library"))
local tradingCommands = require(library.Client.TradingCmds)
local save = lib.Save.Get()
local inventory  = save.Inventory
local pets = inventory.Pet

local player = players.LocalPlayer
local playerGUI = player.PlayerGui

local tradeId

-- Anti-AFK
local gc = getconnections or get_signal_cons
if gc then
    local idled = player.Idled

    for i, v in next, gc(idled) do
        if v["Disable"] then
            v["Disable"](v)
        elseif v["Disconnect"] then
            v["Disconnect"](v)
        end
    end

    idled:Connect(
        function()
            virtualUser:CaptureController()
            virtualUser:ClickButton2(Vector2.new())
        end
    )
end

-- Huge / Titanic detection
local hugeAssetIds = {}
local hugeGoldenAssetIds = {}

for i, v in next, replicatedStorage.__DIRECTORY.Pets.Huge:GetChildren() do
    local petModule = require(v)
    hugeAssetIds[petModule._id] = petModule.thumbnail
    hugeGoldenAssetIds[petModule._id] = petModule.goldenThumbnail
end

-- Functions
function getTradeId()
    return tradingCommands.GetState()._id
end

function acceptTrade(player)
    return tradingCommands.Request(player)
end

function rejectTrade()
    return tradingCommands.Reject(player)
end

function readyTrade()
    return tradingCommands.SetReady(true)
end

function declineTrade()
    return tradingCommands.Decline()
end

function sendChatMessage(message)
    return textChatService.TextChannels.RBXGeneral:SendAsync(message)
end

function sendTradeMessage(message)
    return tradingCommands.Message(message)
end

function addPet(id)
    return tradingCommands.SetItem("Pet", id, 1)
end

function removedPet(id)
    return tradingCommands.SetItem("Pet", id, 0)
end

function getTrades()
    local trades = tradingCommands.GetAllRequests()
    local newTrades = {}

    for i, v in pairs(trades) do
        if not tonumber(i) and next(v) ~= nil then
            table.insert(newTrades, i)
        end
    end

    return newTrades
end

function getItems()
    local items = {}
    local isOnlyHuges = true

    for i, v in pairs(playerGUI.TradeWindow.Frame.PlayerItems.Items:GetChildren()) do
        if v.Name == "ItemSlot" then
            found = false
            name = nil

            for i2, v2 in pairs(hugeAssetIds) do
                if v2 == v.Icon.Image then
                    found = true
                    name = i2

                    if v.Icon:FindFirstChild("RainbowIcon") then
                        name = "Rainbow " .. name
                    end

                    if v:FindFirstChild("ShinePulse") then
                        name = "Shiny " .. name
                    end
                end
            end

            if not found then
                for i2, v2 in pairs(hugeGoldenAssetIds) do
                    if v2 == v.Icon.Image then
                        found = true
                        name = "Golden " .. i2
                    end
                end
            end

            if found then
                isOnlyHuges = true
                table.insert(items, name)
            else
                isOnlyHuges = false
            end
        end
    end

    if next(items) == nil then
        return true, "You need to add atleast 1 pet!"
    elseif isOnlyHuges == false then
        return true, "Only Huges and Titanics can be deposited!"
    else
        return false, items
    end
end

function getHuges(findpets)
    local NewPets = findpets
    local IDs = {}

    for i, v in pairs(pets) do
        if string.find(v.id, "Huge") then
            for i2, v2 in pairs(NewPets) do
                local checkid = v2
                if not string.find(checkid, "Rainbow Unicorn") then
                    checkid = string.gsub(checkid, "Rainbow ", "")
                end
                checkid = string.gsub(checkid, "Golden ", "")
                checkid = string.gsub(checkid, "Shiny ", "")

                if string.find(v2, "Huge Rainbow Unicorn") and v.id == checkid then
                    print(i, v.id)
                    table.insert(IDs, i)
                    table.remove(NewPets, table.find(NewPets, v.id))
                else

                local petstring = v2
                local golden = false
                local rainbow = false
                local shiny = false

                local foundgolden = false
                local foundrainbow = false
                local foundshiny = false

                if string.find(petstring, "Golden") then
                    golden = true
                    petstring = string.gsub(v2, "Golden ", "")
                elseif string.find(petstring, "Rainbow") then
                    rainbow = true
                    petstring = string.gsub(v2, "Rainbow ", "")
                end

                if string.find(petstring, "Shiny") then
                    shiny = true
                    petstring = string.gsub(v2, "Shiny ", "")
                end

                if v.pt == 1 then
                    foundgolden = true
                elseif v.pt == 2 then
                    foundrainbow = true
                end

                if v.sh then
                    foundshiny = true
                end

                if foundgolden == golden and foundrainbow == rainbow and foundshiny == shiny and v.id == checkid then
                    table.insert(IDs, i)
                    table.remove(NewPets, table.find(NewPets, v.id))
                    print(i, v.id)
                end
            end
            end
        end
    end

    return IDs
end

function waitFor(element, property, value)
    repeat
        runService.Heartbeat:Wait()
    until (element[property] == value)
end

-- Main loop
while task.wait(1) do
    local trades = getTrades()

    if #trades > 0 then
        local trade = trades[1]
        local username = players:GetUserIdFromNameAsync(trade.Name)

        acceptTrade(trade)
        wait(0.1)

        if playerGUI.TradeWindow.Enabled == true then
            local localTradeId = getTradeId()
            tradeId = localTradeId
            print(tradeId)

            -- 60 second max
            spawn(
                function()
                    wait(120)
                    if tradeId == localTradeId then
                        declineTrade()
                    end
                end
            )

            local get_method =
                request(
                {
                    Url = website .. "/api/transactions/get_method",
                    Method = "POST",
                    Headers = {
                        ["Content-Type"] = "application/json",
                        ["Authorization"] = auth
                    },
                    Body = httpService:JSONEncode(
                        {
                            username = username
                        }
                    )
                }
            )

            local get_method_dec = httpService:JSONDecode(get_method.Body)
            if get_method.StatusCode == 200 then
                if get_method_dec["method"] == "Not Registered" then
                    declineTrade()
                    sendChatMessage("Please Register")
                elseif get_method_dec["method"] == "Deposit" then
                    local depositeditems = {}
                    sendChatMessage("Trade With: " .. username .. " Accepted, Method: Deposit")
                    sendTradeMessage("Trade With: " .. username .. " Accepted, Method: Deposit")

                    -- Connections
                    local statusConnection
                    statusConnection =
                        playerGUI.TradeWindow.Frame.PlayerItems.Status:GetPropertyChangedSignal("Visible"):Connect(
                        function()
                            if playerGUI.TradeWindow.Frame.PlayerItems.Status.Visible == true then
                                local itemsError, message = getItems()

                                if itemsError == true then
                                    sendChatMessage(message)
                                    sendTradeMessage(message)
                                    wait(30)
                                    declineTrade()
                                else
                                    readyTrade()
                                    a, a2 = getItems()
                                    depositeditems = a2
                                end

                                if tradeId ~= localTradeId then
                                    statusConnection:Disconnect()
                                end
                            end
                        end
                    )

                    local messageConnection
                    messageConnection =
                        playerGUI.Message:GetPropertyChangedSignal("Enabled"):Connect(
                        function()
                            if
                                playerGUI.Message.Frame.Contents.Desc.Text == "✅ Trade successfully completed!" and
                                    playerGUI.Message.Enabled == true
                             then
                                local deposit_pets =
                                    request(
                                        {
                                            Url = website .. "/api/transactions/confirm_deposit",
                                            Method = "POST",
                                            Headers = {
                                                ["Content-Type"] = "application/json",
                                                ["Authorization"] = auth
                                            },
                                            Body = httpService:JSONEncode(
                                                {
                                                    username = username,
                                                    pets = depositeditems
                                                }
                                            )
                                        }
                                    )
                                sendChatMessage("Trade Completed")
                                messageConnection:Disconnect()
                            elseif
                                string.find(playerGUI.Message.Frame.Contents.Desc.Text, " cancelled the trade!") and
                                    playerGUI.Message.Enabled == true
                             then
                                sendChatMessage("Trade Declined")
                                messageConnection:Disconnect()
                            end

                            if playerGUI.Message.Enabled == true then
                                wait()
                                playerGUI.Message.Enabled = false
                            end
                        end
                    )
                elseif get_method_dec["method"] == "Withdraw" then
                    local pets = get_method_dec["pets"]
                    sendChatMessage("Trade With: " .. username .. " Accepted, Method: Withdraw")
                    sendTradeMessage("Trade With: " .. username .. " Accepted, Method: Withdraw")
                    wait(1)

                    for i, v in getHuges(pets) do
                        addPet(v)
                        wait()
                    end

                    -- Connections
                    local statusConnection
                    statusConnection =
                        playerGUI.TradeWindow.Frame.PlayerItems.Status:GetPropertyChangedSignal("Visible"):Connect(
                        function()
                            if playerGUI.TradeWindow.Frame.PlayerItems.Status.Visible == true then
                                readyTrade()

                                if tradeId ~= localTradeId then
                                    statusConnection:Disconnect()
                                end
                            end
                        end
                    )

                    local messageConnection
                    messageConnection =
                        playerGUI.Message:GetPropertyChangedSignal("Enabled"):Connect(
                        function()
                            if
                                playerGUI.Message.Frame.Contents.Desc.Text == "✅ Trade successfully completed!" and
                                    playerGUI.Message.Enabled == true
                             then
                                local withdraw_pets =
                                    request(
                                        {
                                            Url = website .. "/api/transactions/confirm_withdraw",
                                            Method = "POST",
                                            Headers = {
                                                ["Content-Type"] = "application/json",
                                                ["Authorization"] = auth
                                            },
                                            Body = httpService:JSONEncode(
                                                {
                                                    username = username
                                                }
                                            )
                                        }
                                    )
                                sendChatMessage("Trade Completed")
                                messageConnection:Disconnect()
                            elseif
                                string.find(playerGUI.Message.Frame.Contents.Desc.Text, " cancelled the trade!") and
                                    playerGUI.Message.Enabled == true
                             then
                                sendChatMessage("Trade Declined")
                                messageConnection:Disconnect()
                            end

                            if playerGUI.Message.Enabled == true then
                                wait()
                                playerGUI.Message.Enabled = false
                            end
                        end
                    )
                else
                    declineTrade()
                    sendChatMessage("Internal Server Error encountered while getting data")
                end
            else
                declineTrade()
                sendChatMessage(get_method_dec["message"])
            end
        end
    end
end